import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount, listAccessibleAccounts } from "../utils/accountAccess.js";
import { shiftMonth } from "../utils/dateMath.js";
import { buildItemTree, flattenLeafItems } from "../utils/budgetItemTree.js";
import { computeBudgetBreakdown, type BudgetMethodKey } from "../constants/budgetMethods.js";
import type { Expense } from "@prisma/client";

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

const CATEGORY_VALUES = ["BESOINS", "ENVIES", "EPARGNE"] as const;

function serializeExpense(expense: Expense & { bankAccount: { name: string } }, unusual: boolean) {
  return {
    id: expense.id,
    year: expense.year,
    month: expense.month,
    poste: expense.poste,
    category: expense.category,
    amount: expense.amount.toString(),
    note: expense.note,
    bankAccountId: expense.bankAccountId,
    bankAccountName: expense.bankAccount.name,
    unusual,
    createdAt: expense.createdAt,
  };
}

async function computeUnusualIds(
  accountIds: string[],
  year: number,
  month: number,
  expenses: Pick<Expense, "id" | "poste" | "amount">[],
) {
  if (expenses.length === 0) return new Set<string>();

  const windows = [1, 2, 3].map((d) => shiftMonth(year, month, -d));
  const history = await prisma.expense.findMany({
    where: {
      bankAccountId: { in: accountIds },
      OR: windows.map((w) => ({ year: w.year, month: w.month })),
    },
    select: { poste: true, amount: true },
  });

  const stats = new Map<string, { sum: number; count: number }>();
  for (const h of history) {
    const key = h.poste.trim().toLowerCase();
    const s = stats.get(key) ?? { sum: 0, count: 0 };
    s.sum += Number(h.amount);
    s.count += 1;
    stats.set(key, s);
  }

  const unusual = new Set<string>();
  for (const e of expenses) {
    const key = e.poste.trim().toLowerCase();
    const s = stats.get(key);
    if (!s || s.count < 2) continue;
    const avg = s.sum / s.count;
    const amount = Number(e.amount);
    if (amount > avg * 1.5 && amount - avg > 20) {
      unusual.add(e.id);
    }
  }
  return unusual;
}

const yearMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

expensesRouter.get("/", async (req, res) => {
  const parsed = yearMonthQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Année ou mois invalide." });
    return;
  }
  const { year, month } = parsed.data;

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [expenses, incomes, template] = await Promise.all([
    prisma.expense.findMany({
      where: { year, month, bankAccountId: { in: accountIds } },
      include: { bankAccount: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.income.findMany({ where: { year, month, bankAccountId: { in: accountIds } }, select: { amount: true } }),
    prisma.budgetTemplate.findUnique({ where: { userId: req.userId! } }),
  ]);

  const unusualIds = await computeUnusualIds(accountIds, year, month, expenses);

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const byCategory = { besoins: 0, envies: 0, epargne: 0 };
  for (const e of expenses) {
    if (e.category === "BESOINS") byCategory.besoins += Number(e.amount);
    else if (e.category === "ENVIES") byCategory.envies += Number(e.amount);
    else byCategory.epargne += Number(e.amount);
  }

  let budgetComparison = null;
  if (template) {
    const breakdown = computeBudgetBreakdown(template.method as BudgetMethodKey, Number(template.monthlyIncome), {
      besoins: byCategory.besoins,
      envies: byCategory.envies,
      epargne: byCategory.epargne,
    });
    const hasFixedTargets = template.method !== "BASE_ZERO";
    if (hasFixedTargets) {
      const overBudgetCategories: { category: string; actual: number; target: number; overBy: number }[] = [];
      const checks: [string, number, number][] = [
        ["BESOINS", byCategory.besoins, breakdown.besoinsTarget],
        ["ENVIES", byCategory.envies, breakdown.enviesTarget],
        ["EPARGNE", byCategory.epargne, breakdown.epargneTarget],
      ];
      for (const [category, actual, target] of checks) {
        if (actual > target) {
          overBudgetCategories.push({ category, actual, target, overBy: actual - target });
        }
      }
      budgetComparison = {
        method: template.method,
        besoinsTarget: breakdown.besoinsTarget,
        enviesTarget: breakdown.enviesTarget,
        epargneTarget: breakdown.epargneTarget,
        overBudgetCategories,
      };
    }
  }

  res.json({
    expenses: expenses.map((e) => serializeExpense(e, unusualIds.has(e.id))),
    summary: { totalSpent, totalIncome, byCategory, budgetComparison },
  });
});

const createExpenseSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  poste: z.string().trim().min(1).max(80),
  category: z.enum(CATEGORY_VALUES),
  amount: z.number().finite().positive("Le montant doit être positif."),
  note: z.string().trim().max(200).optional(),
  bankAccountId: z.string().min(1),
});

expensesRouter.post("/", async (req, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const accountResult = await loadAccessibleAccount(req.userId!, parsed.data.bankAccountId);
  if ("error" in accountResult) {
    res.status(accountResult.error).json({ error: "Compte bancaire introuvable ou non accessible." });
    return;
  }

  const expense = await prisma.expense.create({
    data: { ...parsed.data, note: parsed.data.note || null },
    include: { bankAccount: { select: { name: true } } },
  });

  res.status(201).json({ expense: serializeExpense(expense, false) });
});

async function loadOwnExpense(userId: string, expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { error: 404 as const };
  const accountResult = await loadAccessibleAccount(userId, expense.bankAccountId);
  if ("error" in accountResult) return accountResult;
  return { expense };
}

const updateExpenseSchema = z.object({
  poste: z.string().trim().min(1).max(80).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  amount: z.number().finite().positive("Le montant doit être positif.").optional(),
  note: z.string().trim().max(200).optional(),
});

expensesRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnExpense(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Dépense introuvable." : "Accès refusé." });
    return;
  }

  const parsed = updateExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const expense = await prisma.expense.update({
    where: { id: result.expense.id },
    data: parsed.data,
    include: { bankAccount: { select: { name: true } } },
  });

  res.json({ expense: serializeExpense(expense, false) });
});

expensesRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnExpense(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Dépense introuvable." : "Accès refusé." });
    return;
  }

  await prisma.expense.delete({ where: { id: result.expense.id } });
  res.status(204).send();
});

const copyMonthSchema = z.object({
  fromYear: z.number().int().min(2000).max(2100),
  fromMonth: z.number().int().min(1).max(12),
  toYear: z.number().int().min(2000).max(2100),
  toMonth: z.number().int().min(1).max(12),
});

expensesRouter.post("/copy-month", async (req, res) => {
  const parsed = copyMonthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const { fromYear, fromMonth, toYear, toMonth } = parsed.data;
  if (fromYear === toYear && fromMonth === toMonth) {
    res.status(400).json({ error: "Le mois source et le mois cible doivent être différents." });
    return;
  }

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const source = await prisma.expense.findMany({
    where: { year: fromYear, month: fromMonth, bankAccountId: { in: accountIds } },
  });
  if (source.length === 0) {
    res.status(404).json({ error: "Aucune dépense à copier pour le mois source." });
    return;
  }

  await prisma.$transaction([
    prisma.expense.deleteMany({ where: { year: toYear, month: toMonth, bankAccountId: { in: accountIds } } }),
    prisma.expense.createMany({
      data: source.map((e) => ({
        year: toYear,
        month: toMonth,
        poste: e.poste,
        category: e.category,
        amount: e.amount,
        note: e.note,
        bankAccountId: e.bankAccountId,
      })),
    }),
  ]);

  res.status(201).json({ copied: source.length });
});

const copyTemplateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  bankAccountId: z.string().min(1),
});

expensesRouter.post("/copy-budget-template", async (req, res) => {
  const parsed = copyTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const { year, month, bankAccountId } = parsed.data;

  const accountResult = await loadAccessibleAccount(req.userId!, bankAccountId);
  if ("error" in accountResult) {
    res.status(accountResult.error).json({ error: "Compte bancaire introuvable ou non accessible." });
    return;
  }

  const template = await prisma.budgetTemplate.findUnique({ where: { userId: req.userId! } });
  if (!template) {
    res.status(409).json({ error: "Crée d'abord ton budget type." });
    return;
  }

  const items = await prisma.budgetItem.findMany({ where: { templateId: template.id } });
  const leaves = flattenLeafItems(buildItemTree(items)).filter((leaf) => leaf.displayedAmount > 0);
  if (leaves.length === 0) {
    res.status(404).json({ error: "Ton budget type n'a aucun poste avec un montant à copier." });
    return;
  }

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  await prisma.$transaction([
    prisma.expense.deleteMany({ where: { year, month, bankAccountId: { in: accountIds } } }),
    prisma.expense.createMany({
      data: leaves.map((leaf) => ({
        year,
        month,
        poste: leaf.name,
        category: leaf.category as "BESOINS" | "ENVIES" | "EPARGNE",
        amount: leaf.displayedAmount,
        bankAccountId,
      })),
    }),
  ]);

  res.status(201).json({ copied: leaves.length });
});

const clearMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

expensesRouter.post("/clear-month", async (req, res) => {
  const parsed = clearMonthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const { count } = await prisma.expense.deleteMany({
    where: { year: parsed.data.year, month: parsed.data.month, bankAccountId: { in: accountIds } },
  });

  res.json({ deleted: count });
});
