import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount, listAccessibleAccounts } from "../utils/accountAccess.js";
import type { Income } from "@prisma/client";

export const incomesRouter = Router();

incomesRouter.use(requireAuth);

function serializeIncome(income: Income & { bankAccount: { name: string } }) {
  return {
    id: income.id,
    year: income.year,
    month: income.month,
    source: income.source,
    amount: income.amount.toString(),
    bankAccountId: income.bankAccountId,
    bankAccountName: income.bankAccount.name,
    createdAt: income.createdAt,
  };
}

const yearMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

incomesRouter.get("/", async (req, res) => {
  const parsed = yearMonthQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Année ou mois invalide." });
    return;
  }

  const accounts = await listAccessibleAccounts(req.userId!);
  const incomes = await prisma.income.findMany({
    where: {
      year: parsed.data.year,
      month: parsed.data.month,
      bankAccountId: { in: accounts.map((a) => a.id) },
    },
    include: { bankAccount: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ incomes: incomes.map(serializeIncome) });
});

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

incomesRouter.get("/summary", async (req, res) => {
  const parsed = yearQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Année invalide." });
    return;
  }

  const accounts = await listAccessibleAccounts(req.userId!);
  const incomes = await prisma.income.findMany({
    where: { year: parsed.data.year, bankAccountId: { in: accounts.map((a) => a.id) } },
    select: { month: true, amount: true },
  });

  const totalsByMonth = Array.from({ length: 12 }, () => 0);
  for (const income of incomes) {
    totalsByMonth[income.month - 1] += Number(income.amount);
  }

  res.json({ year: parsed.data.year, totalsByMonth });
});

const createIncomeSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  source: z.string().trim().min(1).max(80),
  amount: z.number().finite().positive("Le montant doit être positif."),
  bankAccountId: z.string().min(1),
});

incomesRouter.post("/", async (req, res) => {
  const parsed = createIncomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const accountResult = await loadAccessibleAccount(req.userId!, parsed.data.bankAccountId);
  if ("error" in accountResult) {
    res.status(accountResult.error).json({ error: "Compte bancaire introuvable ou non accessible." });
    return;
  }

  const income = await prisma.income.create({
    data: parsed.data,
    include: { bankAccount: { select: { name: true } } },
  });

  res.status(201).json({ income: serializeIncome(income) });
});

async function loadOwnedIncome(userId: string, incomeId: string) {
  const income = await prisma.income.findUnique({ where: { id: incomeId } });
  if (!income) return { error: 404 as const };

  const accountResult = await loadAccessibleAccount(userId, income.bankAccountId);
  if ("error" in accountResult) return accountResult;
  return { income };
}

const updateIncomeSchema = z.object({
  source: z.string().trim().min(1).max(80).optional(),
  amount: z.number().finite().positive("Le montant doit être positif.").optional(),
});

incomesRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnedIncome(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Revenu introuvable." : "Accès refusé." });
    return;
  }

  const parsed = updateIncomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const income = await prisma.income.update({
    where: { id: result.income.id },
    data: parsed.data,
    include: { bankAccount: { select: { name: true } } },
  });

  res.json({ income: serializeIncome(income) });
});

incomesRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnedIncome(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Revenu introuvable." : "Accès refusé." });
    return;
  }

  await prisma.income.delete({ where: { id: result.income.id } });
  res.status(204).send();
});

const copyMonthSchema = z.object({
  fromYear: z.number().int().min(2000).max(2100),
  fromMonth: z.number().int().min(1).max(12),
  toYear: z.number().int().min(2000).max(2100),
  toMonth: z.number().int().min(1).max(12),
});

incomesRouter.post("/copy-month", async (req, res) => {
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

  const source = await prisma.income.findMany({
    where: { year: fromYear, month: fromMonth, bankAccountId: { in: accountIds } },
  });

  if (source.length === 0) {
    res.status(404).json({ error: "Aucun revenu à copier pour le mois source." });
    return;
  }

  await prisma.$transaction([
    prisma.income.deleteMany({ where: { year: toYear, month: toMonth, bankAccountId: { in: accountIds } } }),
    prisma.income.createMany({
      data: source.map((income) => ({
        year: toYear,
        month: toMonth,
        source: income.source,
        amount: income.amount,
        bankAccountId: income.bankAccountId,
      })),
    }),
  ]);

  const incomes = await prisma.income.findMany({
    where: { year: toYear, month: toMonth, bankAccountId: { in: accountIds } },
    include: { bankAccount: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.status(201).json({ incomes: incomes.map(serializeIncome) });
});
