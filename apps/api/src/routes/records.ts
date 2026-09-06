import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { sumByCategory } from "../utils/expenseCategoryTotals.js";
import { computeSavingsStreak } from "../utils/savingsStreak.js";
import { computePersonalRecords } from "../utils/personalRecords.js";

export const recordsRouter = Router();

recordsRouter.use(requireAuth);

function monthKey(year: number, month: number) {
  return year * 12 + (month - 1);
}

function addMonths(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// Streak (section 52) et records personnels (section 53) : tout est
// recalcule a la lecture depuis l'historique existant, jamais stocke, pour
// ne jamais diverger d'un ecran a l'autre et rester coherent si une
// depense passee est corrigee apres coup.
recordsRouter.get("/", async (req, res) => {
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { bankAccountId: { in: accountIds } },
      select: { year: true, month: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { bankAccountId: { in: accountIds } },
      select: {
        year: true,
        month: true,
        category: true,
        amount: true,
        feeling: true,
        splits: { select: { category: true, amount: true } },
      },
    }),
  ]);

  if (incomes.length === 0 && expenses.length === 0) {
    res.json({
      currentStreak: 0,
      bestStreak: 0,
      bestEpargneMonth: null,
      bestSavingsRateMonth: null,
      bestRegretMonth: null,
    });
    return;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const firstKey = Math.min(
    ...incomes.map((i) => monthKey(i.year, i.month)),
    ...expenses.map((e) => monthKey(e.year, e.month)),
  );
  const currentKey = monthKey(currentYear, currentMonth);
  const monthCount = Math.max(currentKey - firstKey + 1, 1);
  const firstYear = Math.floor(firstKey / 12);
  const firstMonth = (firstKey % 12) + 1;

  const monthList = Array.from({ length: monthCount }, (_, i) => addMonths(firstYear, firstMonth, i));

  const incomeByMonth = new Map<string, number>();
  for (const income of incomes) {
    const key = `${income.year}-${income.month}`;
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + Number(income.amount));
  }

  const expensesByMonth = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    const key = `${expense.year}-${expense.month}`;
    if (!expensesByMonth.has(key)) expensesByMonth.set(key, []);
    expensesByMonth.get(key)!.push(expense);
  }

  const monthlyData = monthList.map(({ year, month }) => {
    const key = `${year}-${month}`;
    const income = incomeByMonth.get(key) ?? 0;
    const monthExpenses = expensesByMonth.get(key) ?? [];
    const epargne = sumByCategory(
      monthExpenses.map((e) => ({
        amount: Number(e.amount),
        category: e.category,
        splits: e.splits.map((s) => ({ category: s.category, amount: Number(s.amount) })),
      })),
      ["EPARGNE"],
    ).EPARGNE;
    const regretTotal = monthExpenses.filter((e) => e.feeling === "REGRET").reduce((sum, e) => sum + Number(e.amount), 0);
    const hasActivity = income > 0 || monthExpenses.length > 0;
    return { year, month, income, epargne, regretTotal, hasActivity };
  });

  const streak = computeSavingsStreak(monthlyData.map((m) => ({ year: m.year, month: m.month, amount: m.epargne })));
  const records = computePersonalRecords(monthlyData);

  res.json({
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    ...records,
  });
});
