import { describe, expect, it } from "vitest";
import { computeDiscrepancy, computeExpectedBalance, isSignificantDiscrepancy, monthsInRange } from "./reconciliation.js";

describe("monthsInRange", () => {
  it("liste les mois d'une même année", () => {
    expect(monthsInRange(2026, 3, 2026, 5)).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
    ]);
  });

  it("traverse le passage d'année", () => {
    expect(monthsInRange(2025, 11, 2026, 2)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });

  it("un seul mois quand from === to", () => {
    expect(monthsInRange(2026, 6, 2026, 6)).toEqual([{ year: 2026, month: 6 }]);
  });
});

describe("computeExpectedBalance", () => {
  it("solde attendu = solde précédent + revenus - dépenses", () => {
    const expected = computeExpectedBalance({
      previousStatedBalance: 1000,
      incomesTotal: 2000,
      expensesTotal: 1500,
      transfersInTotal: 0,
      transfersOutTotal: 0,
    });
    expect(expected).toBe(1500);
  });

  it("intègre les transferts entrants et sortants", () => {
    const expected = computeExpectedBalance({
      previousStatedBalance: 1000,
      incomesTotal: 0,
      expensesTotal: 0,
      transfersInTotal: 300,
      transfersOutTotal: 100,
    });
    expect(expected).toBe(1200);
  });
});

describe("computeDiscrepancy", () => {
  it("est positif quand le solde constaté dépasse le solde attendu", () => {
    expect(computeDiscrepancy(1100, 1000)).toBe(100);
  });

  it("est négatif quand le solde constaté est inférieur au solde attendu (exemple spec: 82,43 €)", () => {
    expect(computeDiscrepancy(917.57, 1000)).toBeCloseTo(-82.43, 2);
  });

  it("arrondit au centime pour absorber les imprécisions flottantes", () => {
    expect(computeDiscrepancy(0.1 + 0.2, 0.3)).toBe(0);
  });
});

describe("isSignificantDiscrepancy", () => {
  it("ignore les écarts d'arrondi inférieurs au centime", () => {
    expect(isSignificantDiscrepancy(0)).toBe(false);
    expect(isSignificantDiscrepancy(0.005)).toBe(false);
  });

  it("signale tout écart réel, même faible", () => {
    expect(isSignificantDiscrepancy(0.02)).toBe(true);
    expect(isSignificantDiscrepancy(-82.43)).toBe(true);
  });
});
