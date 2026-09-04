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

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const household = user.householdId
    ? await prisma.household.findUnique({ where: { id: user.householdId } })
    : null;
  const fiscalYearStartMonth = household?.fiscalYearStartMonth ?? 1;

  // Fenetre de 12 mois affichee : calendaire (janvier a decembre de `year`)
  // si le foyer n'a pas de mois de depart personnalise, sinon une fenetre
  // glissante qui peut chevaucher deux annees civiles.
  const windowMonths = Array.from({ length: 12 }, (_, i) => {
    const offset = fiscalYearStartMonth - 1 + i;
    return { month: (offset % 12) + 1, year: offset < 12 ? year : year + 1 };
  });
  const years = [...new Set(windowMonths.map((w) => w.year))];

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [incomes, expenses, template] = await Promise.all([
    prisma.income.findMany({ where: { year: { in: years }, bankAccountId: { in: accountIds } }, select: { year: true, month: true, amount: true } }),
    prisma.expense.findMany({ where: { year: { in: years }, bankAccountId: { in: accountIds } }, select: { year: true, month: true, amount: true } }),
    prisma.budgetTemplate.findUnique({ where: { userId: req.userId! } }),
  ]);

  const monthly = windowMonths.map((w) => ({ month: w.month, year: w.year, income: 0, expense: 0, reste: 0 }));
  const indexOf = (y: number, m: number) => monthly.findIndex((entry) => entry.year === y && entry.month === m);

  for (const income of incomes) {
    const idx = indexOf(income.year, income.month);
    if (idx !== -1) monthly[idx].income += Number(income.amount);
  }
  for (const expense of expenses) {
    const idx = indexOf(expense.year, expense.month);
    if (idx !== -1) monthly[idx].expense += Number(expense.amount);
  }
  for (const m of monthly) {
    m.reste = m.income - m.expense;
  }

  const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthly.reduce((sum, m) => sum + m.expense, 0);

  res.json({
    year,
    fiscalYearStartMonth,
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
