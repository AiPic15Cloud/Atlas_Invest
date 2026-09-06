import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { computeAnnualTotals, computeMonthlyAverages } from "../utils/annualSummary.js";
import { simulateStressTest, type StressTestScenario } from "../utils/stressTest.js";

export const stressTestsRouter = Router();

stressTestsRouter.use(requireAuth);

const scenarioSchema = z.union([
  z.object({ type: z.literal("INCOME_LOSS"), monthlyAmount: z.number().finite().nonnegative() }),
  z.object({ type: z.literal("INCOME_DROP_PERCENT"), percent: z.number().finite().min(0).max(100) }),
  z.object({ type: z.literal("ONE_OFF_EXPENSE"), amount: z.number().finite().nonnegative() }),
  z.object({ type: z.literal("RECURRING_EXPENSE_INCREASE"), monthlyAmount: z.number().finite().nonnegative() }),
]);

// Bac a sable (section 60) : ne modifie jamais les donnees reelles. Le
// rythme mensuel moyen s'appuie sur les 12 derniers mois glissants (plus
// stable qu'un seul mois pour juger d'une resistance a un choc), et le
// tampon disponible est l'epargne de precaution deja construite -- jamais
// le solde bancaire brut, qui inclut de l'argent deja affecte ailleurs.
stressTestsRouter.post("/simulate", async (req, res) => {
  const parsed = scenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Scénario invalide." });
    return;
  }

  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const years = [...new Set(months.map((m) => m.year))];

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [incomes, expenses, emergencyFund] = await Promise.all([
    prisma.income.findMany({
      where: { year: { in: years }, bankAccountId: { in: accountIds } },
      select: { year: true, month: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { year: { in: years }, bankAccountId: { in: accountIds } },
      select: { year: true, month: true, amount: true },
    }),
    prisma.emergencyFundProfile.findUnique({ where: { userId: req.userId! } }),
  ]);

  const monthly = months.map(({ year, month }) => ({
    income: incomes.filter((i) => i.year === year && i.month === month).reduce((sum, i) => sum + Number(i.amount), 0),
    expense: expenses.filter((e) => e.year === year && e.month === month).reduce((sum, e) => sum + Number(e.amount), 0),
  }));
  const totals = computeAnnualTotals(monthly);
  const averages = computeMonthlyAverages(totals, months.length);

  const availableBuffer = emergencyFund ? Number(emergencyFund.currentSavedAmount) : 0;

  const result = simulateStressTest(
    averages.incomePerMonth,
    averages.expensePerMonth,
    availableBuffer,
    parsed.data as StressTestScenario,
  );

  res.json({
    baselineMonthlyIncome: averages.incomePerMonth,
    baselineMonthlyExpenses: averages.expensePerMonth,
    availableBuffer,
    hasEmergencyFund: emergencyFund !== null,
    ...result,
  });
});
