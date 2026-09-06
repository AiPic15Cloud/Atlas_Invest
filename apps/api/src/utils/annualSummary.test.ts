import { describe, expect, it } from "vitest";
import { computeAnnualTotals, computeMonthlyAverages } from "./annualSummary.js";

// Lot 1 — Correction revenus : verrouille la relation annuel <-> mensuel
// pour empêcher toute confusion future (ex. diviser un total annuel par 1
// au lieu de 12, ou multiplier un revenu mensuel par 12 en le faisant
// passer pour un total déjà annuel).
describe("computeAnnualTotals", () => {
  it("somme les 12 mois pour obtenir le total annuel", () => {
    const monthly = Array.from({ length: 12 }, (_, i) => ({ income: 3000, expense: 2000 + i }));
    const totals = computeAnnualTotals(monthly);
    expect(totals.income).toBe(3000 * 12);
    expect(totals.expenses).toBe(monthly.reduce((s, m) => s + m.expense, 0));
    expect(totals.reste).toBe(totals.income - totals.expenses);
  });

  it("retourne des totaux nuls sur une fenêtre vide", () => {
    expect(computeAnnualTotals([])).toEqual({ income: 0, expenses: 0, reste: 0 });
  });
});

describe("computeMonthlyAverages", () => {
  it("divise le total annuel par le nombre de mois pour retrouver le revenu mensuel", () => {
    const monthlyIncome = 3200;
    const totals = computeAnnualTotals(Array.from({ length: 12 }, () => ({ income: monthlyIncome, expense: 0 })));
    const averages = computeMonthlyAverages(totals, 12);
    expect(averages.incomePerMonth).toBeCloseTo(monthlyIncome, 6);
  });

  it("ne confond jamais total annuel et moyenne mensuelle (12 mois à revenu constant)", () => {
    const monthlyIncome = 2500;
    const monthly = Array.from({ length: 12 }, () => ({ income: monthlyIncome, expense: 0 }));
    const totals = computeAnnualTotals(monthly);
    const averages = computeMonthlyAverages(totals, monthly.length);

    // Le total annuel doit être ~12x le revenu mensuel, jamais égal à lui.
    expect(totals.income).toBeCloseTo(monthlyIncome * 12, 6);
    // La moyenne mensuelle doit retrouver le revenu mensuel d'origine, jamais le total annuel.
    expect(averages.incomePerMonth).toBeCloseTo(monthlyIncome, 6);
    expect(averages.incomePerMonth).not.toBeCloseTo(totals.income, 6);
  });

  it("respecte une fenêtre glissante à cheval sur deux années (mois de départ personnalisé)", () => {
    // Ex. année fiscale débutant en avril : 12 mois malgré tout.
    const monthly = Array.from({ length: 12 }, (_, i) => ({ income: 1000 + i * 10, expense: 500 }));
    const totals = computeAnnualTotals(monthly);
    const averages = computeMonthlyAverages(totals, monthly.length);
    expect(averages.incomePerMonth).toBeCloseTo(totals.income / 12, 6);
  });
});
