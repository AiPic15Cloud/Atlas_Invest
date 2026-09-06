// Agrégation revenu/dépense annuel <-> mensuel pour le Tableau de bord.
// Isolé dans un module pur (sans Prisma/Express) pour pouvoir verifier par
// des tests que la moyenne mensuelle est bien le total annuel divisé par le
// nombre de mois de la fenêtre, jamais l'inverse (Lot 1 — Correction revenus).
export interface MonthlyFlow {
  income: number;
  expense: number;
}

export interface AnnualTotals {
  income: number;
  expenses: number;
  reste: number;
}

export interface MonthlyAverages {
  incomePerMonth: number;
  expensePerMonth: number;
}

export function computeAnnualTotals(monthly: MonthlyFlow[]): AnnualTotals {
  const income = monthly.reduce((sum, m) => sum + m.income, 0);
  const expenses = monthly.reduce((sum, m) => sum + m.expense, 0);
  return { income, expenses, reste: income - expenses };
}

// La fenêtre affichée fait toujours 12 mois (voir dashboard.ts), donc la
// moyenne mensuelle divise le total annuel par ce nombre de mois — jamais
// par une autre valeur, et jamais l'inverse (multiplier un revenu mensuel
// pour obtenir un total annuel serait une erreur symétrique).
export function computeMonthlyAverages(totals: AnnualTotals, monthCount: number): MonthlyAverages {
  return {
    incomePerMonth: totals.income / monthCount,
    expensePerMonth: totals.expenses / monthCount,
  };
}
