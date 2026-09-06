import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { BUDGET_METHODS, computeBudgetBreakdown, type BudgetMethodKey } from "../constants/budgetMethods.js";
import { computeAnnualTotals, computeMonthlyAverages } from "../utils/annualSummary.js";
import { sumByCategory } from "../utils/expenseCategoryTotals.js";
import { computeMonthlyProvision } from "../utils/provisions.js";

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

  const annualTotals = computeAnnualTotals(monthly);
  const monthlyAverages = computeMonthlyAverages(annualTotals, windowMonths.length);

  // "Argent réellement disponible" : le solde en banque n'est pas l'argent
  // disponible tant que des échéances connues et des dépenses essentielles
  // habituelles n'ont pas encore été prélevées ce mois-ci.
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const [recurringCharges, currentMonthExpenses, activeProvisions] = await Promise.all([
    prisma.recurringCharge.findMany({
      where: { bankAccountId: { in: accountIds }, active: true },
      select: { amount: true, dayOfMonth: true },
    }),
    prisma.expense.findMany({
      where: { year: currentYear, month: currentMonth, bankAccountId: { in: accountIds } },
      select: { category: true, amount: true, splits: { select: { category: true, amount: true } } },
    }),
    prisma.provision.findMany({ where: { userId: req.userId!, active: true }, select: { annualAmount: true } }),
  ]);

  const currentBalance = accounts.reduce((sum, a) => sum + Number(a.initialBalance), 0);
  const upcomingCharges = recurringCharges
    .filter((c) => c.dayOfMonth >= currentDay)
    .reduce((sum, c) => sum + Number(c.amount), 0);
  // Provisions (spec section 17) : dépenses annuelles mensualisées, comptées
  // dans "l'argent affecté" — déjà réservées, donc déduites du disponible.
  const provisionsTotal = activeProvisions.reduce((sum, p) => sum + computeMonthlyProvision(Number(p.annualAmount)), 0);

  let besoinsRemaining = 0;
  let epargneRemaining = 0;
  if (template && BUDGET_METHODS[template.method as BudgetMethodKey].splitMode !== "ZERO_BASED") {
    // Une dépense divisée (ExpenseSplit, Lot 3) compte pour chacune de ses
    // parts plutôt que pour sa catégorie/montant d'origine — même règle que
    // le résumé "Ce mois : prévu vs réel" côté Budget du mois.
    const currentMonthTotals = sumByCategory(
      currentMonthExpenses.map((e) => ({
        amount: Number(e.amount),
        category: e.category,
        splits: e.splits.map((s) => ({ category: s.category, amount: Number(s.amount) })),
      })),
      ["BESOINS", "EPARGNE"],
    );
    const besoinsSpent = currentMonthTotals.BESOINS;
    const epargneSpent = currentMonthTotals.EPARGNE;
    const breakdown = computeBudgetBreakdown(template.method as BudgetMethodKey, Number(template.monthlyIncome), {
      besoins: besoinsSpent,
      envies: 0,
      epargne: epargneSpent,
    });
    besoinsRemaining = Math.max(0, breakdown.besoinsTarget - besoinsSpent);
    epargneRemaining = Math.max(0, breakdown.epargneTarget - epargneSpent);
  }

  const availableMoney = {
    currentBalance,
    upcomingCharges,
    besoinsRemaining,
    epargneRemaining,
    provisionsTotal,
    amount: currentBalance - upcomingCharges - besoinsRemaining - epargneRemaining - provisionsTotal,
    hasEstimate: Boolean(template && BUDGET_METHODS[template.method as BudgetMethodKey].splitMode !== "ZERO_BASED"),
  };

  res.json({
    year,
    fiscalYearStartMonth,
    totals: annualTotals,
    averages: monthlyAverages,
    monthly,
    availableMoney,
    budgetTemplate: template
      ? { method: template.method, label: BUDGET_METHODS[template.method as BudgetMethodKey].label }
      : null,
  });
});
