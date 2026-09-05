import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount, listAccessibleAccounts } from "../utils/accountAccess.js";
import { shiftMonth } from "../utils/dateMath.js";
import { buildItemTree, flattenLeafItems } from "../utils/budgetItemTree.js";
import { computeBudgetBreakdown, type BudgetMethodKey } from "../constants/budgetMethods.js";
import { normalizePosteKey, computeAutoFeeling } from "../constants/feelingRules.js";
import type { Expense, ExpenseFeeling } from "@prisma/client";

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
    feeling: expense.feeling,
    feelingReviewed: expense.feelingReviewed,
    createdAt: expense.createdAt,
  };
}

/** Regle apprise sur le poste (si l'utilisateur l'a deja corrigee), sinon suggestion automatique V1. */
async function resolveFeeling(
  userId: string,
  poste: string,
  amount: number,
  category: "BESOINS" | "ENVIES" | "EPARGNE",
): Promise<ExpenseFeeling | null> {
  const rule = await prisma.feelingRule.findUnique({
    where: { userId_posteKey: { userId, posteKey: normalizePosteKey(poste) } },
  });
  if (rule) return rule.feeling;
  return computeAutoFeeling(poste, amount, category);
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
  const regretTotal = expenses.filter((e) => e.feeling === "REGRET").reduce((sum, e) => sum + Number(e.amount), 0);
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
    summary: { totalSpent, totalIncome, regretTotal, byCategory, budgetComparison },
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

  const feeling = await resolveFeeling(req.userId!, parsed.data.poste, parsed.data.amount, parsed.data.category);

  const expense = await prisma.expense.create({
    data: { ...parsed.data, note: parsed.data.note || null, feeling },
    include: { bankAccount: { select: { name: true } } },
  });

  res.status(201).json({ expense: serializeExpense(expense, false) });
});

const bulkCreateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  bankAccountId: z.string().min(1),
  items: z
    .array(
      z.object({
        poste: z.string().trim().min(1).max(80),
        category: z.enum(CATEGORY_VALUES),
        amount: z.number().finite().positive("Le montant doit être positif."),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(500),
});

// Utilise par l'import de releve : integre en une fois toutes les lignes
// validees par l'utilisateur (une par transaction detectee).
expensesRouter.post("/bulk", async (req, res) => {
  const parsed = bulkCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { year, month, bankAccountId, items } = parsed.data;

  const accountResult = await loadAccessibleAccount(req.userId!, bankAccountId);
  if ("error" in accountResult) {
    res.status(accountResult.error).json({ error: "Compte bancaire introuvable ou non accessible." });
    return;
  }

  const rules = await prisma.feelingRule.findMany({ where: { userId: req.userId! } });
  const ruleMap = new Map(rules.map((r) => [r.posteKey, r.feeling]));

  const { count } = await prisma.expense.createMany({
    data: items.map((item) => ({
      year,
      month,
      bankAccountId,
      poste: item.poste,
      category: item.category,
      amount: item.amount,
      note: item.note || null,
      feeling: ruleMap.get(normalizePosteKey(item.poste)) ?? computeAutoFeeling(item.poste, item.amount, item.category),
    })),
  });

  res.status(201).json({ created: count });
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
        feeling: e.feeling,
        feelingReviewed: e.feelingReviewed,
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

  const rules = await prisma.feelingRule.findMany({ where: { userId: req.userId! } });
  const ruleMap = new Map(rules.map((r) => [r.posteKey, r.feeling]));

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
        feeling:
          ruleMap.get(normalizePosteKey(leaf.name)) ??
          computeAutoFeeling(leaf.name, leaf.displayedAmount, leaf.category as "BESOINS" | "ENVIES" | "EPARGNE"),
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

const feelingSchema = z.object({
  feeling: z.enum(["SATISFAIT", "NEUTRE", "REGRET"]),
});

const FEELING_LABELS: Record<"SATISFAIT" | "NEUTRE" | "REGRET", string> = {
  SATISFAIT: "satisfait",
  NEUTRE: "neutre",
  REGRET: "regretté",
};

// Correction manuelle du ressenti : l'utilisateur choisit ou corrige son
// ressenti sur la depense, et ce choix est retenu (FeelingRule) pour etre
// applique automatiquement aux futures depenses du meme poste, ainsi qu'aux
// depenses existantes du meme poste qui n'ont pas deja ete corrigees
// individuellement.
expensesRouter.patch("/:id/feeling", async (req, res) => {
  const result = await loadOwnExpense(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Dépense introuvable." : "Accès refusé." });
    return;
  }
  const parsed = feelingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const posteKey = normalizePosteKey(result.expense.poste);
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  await prisma.$transaction([
    prisma.expense.update({
      where: { id: result.expense.id },
      data: { feeling: parsed.data.feeling, feelingReviewed: true },
    }),
    prisma.feelingRule.upsert({
      where: { userId_posteKey: { userId: req.userId!, posteKey } },
      create: { userId: req.userId!, posteKey, feeling: parsed.data.feeling },
      update: { feeling: parsed.data.feeling },
    }),
    prisma.expense.updateMany({
      where: {
        bankAccountId: { in: accountIds },
        poste: { equals: result.expense.poste, mode: "insensitive" },
        feelingReviewed: false,
        id: { not: result.expense.id },
      },
      data: { feeling: parsed.data.feeling },
    }),
    prisma.correctionLog.create({
      data: {
        userId: req.userId!,
        type: "WASTEFUL_EXPENSE",
        label: `${result.expense.poste} marqué comme ${FEELING_LABELS[parsed.data.feeling]}`,
        detail: `${result.expense.amount.toString()} € — ${result.expense.month}/${result.expense.year}`,
      },
    }),
  ]);

  const expense = await prisma.expense.findUniqueOrThrow({
    where: { id: result.expense.id },
    include: { bankAccount: { select: { name: true } } },
  });
  res.json({ expense: serializeExpense(expense, false) });
});

const feelingSummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

expensesRouter.get("/feeling-summary", async (req, res) => {
  const parsed = feelingSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Année invalide." });
    return;
  }
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const expenses = await prisma.expense.findMany({
    where: { year: parsed.data.year, feeling: "REGRET", bankAccountId: { in: accountIds } },
    select: { poste: true, amount: true },
  });

  const byPoste = new Map<string, { poste: string; count: number; total: number }>();
  for (const e of expenses) {
    const key = normalizePosteKey(e.poste);
    const entry = byPoste.get(key) ?? { poste: e.poste, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(e.amount);
    byPoste.set(key, entry);
  }

  res.json({
    year: parsed.data.year,
    total: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    byPoste: [...byPoste.values()].sort((a, b) => b.total - a.total),
  });
});
