import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { BUDGET_METHODS, type BudgetMethodKey } from "../constants/budgetMethods.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

dashboardRouter.get("/", async (req, res) => {
  const parsed = yearQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Année invalide." });
    return;
  }
  const { year } = parsed.data;

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [incomes, expenses, template] = await Promise.all([
    prisma.income.findMany({ where: { year, bankAccountId: { in: accountIds } }, select: { month: true, amount: true } }),
    prisma.expense.findMany({ where: { year, bankAccountId: { in: accountIds } }, select: { month: true, amount: true } }),
    prisma.budgetTemplate.findUnique({ where: { userId: req.userId! } }),
  ]);

  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0, reste: 0 }));
  for (const income of incomes) {
    monthly[income.month - 1].income += Number(income.amount);
  }
  for (const expense of expenses) {
    monthly[expense.month - 1].expense += Number(expense.amount);
  }
  for (const m of monthly) {
    m.reste = m.income - m.expense;
  }

  const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthly.reduce((sum, m) => sum + m.expense, 0);

  res.json({
    year,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      reste: totalIncome - totalExpenses,
    },
    averages: {
      incomePerMonth: totalIncome / 12,
      expensePerMonth: totalExpenses / 12,
    },
    monthly,
    budgetTemplate: template
      ? { method: template.method, label: BUDGET_METHODS[template.method as BudgetMethodKey].label }
      : null,
  });
});
