import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { computeMonthlyProvision } from "../utils/provisions.js";
import { computeRiskyMonths } from "../utils/riskyMonths.js";
import type { AnticipatedExpense } from "@prisma/client";

export const riskyMonthsRouter = Router();

riskyMonthsRouter.use(requireAuth);

const MONTHS_AHEAD = 6;

function serializeAnticipatedExpense(expense: AnticipatedExpense) {
  return {
    id: expense.id,
    label: expense.label,
    amount: Number(expense.amount),
    year: expense.year,
    month: expense.month,
    note: expense.note,
    createdAt: expense.createdAt,
  };
}

riskyMonthsRouter.get("/anticipated", async (req, res) => {
  const expenses = await prisma.anticipatedExpense.findMany({
    where: { userId: req.userId! },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  res.json({ expenses: expenses.map(serializeAnticipatedExpense) });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: z.number().finite().positive(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  note: z.string().trim().max(200).nullable().optional(),
});

riskyMonthsRouter.post("/anticipated", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const expense = await prisma.anticipatedExpense.create({
    data: {
      label: parsed.data.label,
      amount: parsed.data.amount,
      year: parsed.data.year,
      month: parsed.data.month,
      note: parsed.data.note ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json({ expense: serializeAnticipatedExpense(expense) });
});

riskyMonthsRouter.delete("/anticipated/:id", async (req, res) => {
  const expense = await prisma.anticipatedExpense.findUnique({ where: { id: req.params.id } });
  if (!expense || expense.userId !== req.userId) {
    res.status(404).json({ error: "Dépense anticipée introuvable." });
    return;
  }
  await prisma.anticipatedExpense.delete({ where: { id: expense.id } });
  res.status(204).send();
});

// Projette les 6 prochains mois a partir du revenu recurrent et des charges
// fixes deja connues aujourd'hui (echeances + provisions), en y ajoutant les
// depenses ponctuelles anticipees declarees pour chaque mois (section 29).
riskyMonthsRouter.get("/", async (req, res) => {
  const now = new Date();
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [incomes, charges, provisions, anticipated] = await Promise.all([
    prisma.income.findMany({
      where: {
        bankAccountId: { in: accountIds },
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        nature: "RECURRENT",
      },
    }),
    prisma.recurringCharge.findMany({ where: { bankAccountId: { in: accountIds }, active: true } }),
    prisma.provision.findMany({ where: { userId: req.userId!, active: true } }),
    prisma.anticipatedExpense.findMany({ where: { userId: req.userId! } }),
  ]);

  const baselineIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const baselineCharges =
    charges.reduce((sum, c) => sum + Number(c.amount), 0) +
    provisions.reduce((sum, p) => sum + computeMonthlyProvision(Number(p.annualAmount)), 0);

  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const anticipatedExpenses = anticipated
      .filter((a) => a.year === year && a.month === month)
      .reduce((sum, a) => sum + Number(a.amount), 0);
    return { year, month, anticipatedExpenses };
  });

  const riskyMonths = computeRiskyMonths(baselineIncome, baselineCharges, months);

  res.json({
    baselineIncome,
    baselineCharges,
    hasIncomeData: baselineIncome > 0,
    months: riskyMonths,
  });
});
