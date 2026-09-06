import type { BudgetCategory } from "@prisma/client";

// Lot 3 — Splits de dépense (spec section 10). Une dépense sans split
// compte pour la totalité de son montant dans sa propre catégorie (cas
// actuel, inchangé). Une dépense avec des ExpenseSplit compte pour le
// montant de chaque part dans la catégorie de cette part — la dépense
// elle-même (son category/amount) est alors ignorée au profit de ses parts.
export interface CategoryAmount {
  category: BudgetCategory;
  amount: number;
}

export interface ExpenseForCategoryTotals {
  amount: number;
  category: BudgetCategory;
  splits?: CategoryAmount[];
}

// Tolérance d'arrondi (centimes) pour comparer une somme de parts au
// montant total de la dépense.
const ROUNDING_TOLERANCE = 0.01;

export function categoryAmountsFor(expense: ExpenseForCategoryTotals): CategoryAmount[] {
  if (expense.splits && expense.splits.length > 0) return expense.splits;
  return [{ category: expense.category, amount: expense.amount }];
}

export function sumByCategory(
  expenses: ExpenseForCategoryTotals[],
  categories: readonly BudgetCategory[],
): Record<string, number> {
  const totals = Object.fromEntries(categories.map((c) => [c, 0])) as Record<string, number>;
  for (const expense of expenses) {
    for (const part of categoryAmountsFor(expense)) {
      if (part.category in totals) totals[part.category] += part.amount;
    }
  }
  return totals;
}

export function splitsSumMatchesExpense(expenseAmount: number, splits: CategoryAmount[]): boolean {
  const total = splits.reduce((sum, s) => sum + s.amount, 0);
  return Math.abs(total - expenseAmount) <= ROUNDING_TOLERANCE;
}
