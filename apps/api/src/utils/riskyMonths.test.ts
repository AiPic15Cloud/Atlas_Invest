import { describe, expect, it } from "vitest";
import { computeRiskyMonths } from "./riskyMonths.js";

describe("computeRiskyMonths", () => {
  it("aucun mois à risque quand les charges restent sous le revenu", () => {
    const result = computeRiskyMonths(3000, 2000, [
      { year: 2026, month: 10, anticipatedExpenses: 0 },
      { year: 2026, month: 11, anticipatedExpenses: 0 },
    ]);
    expect(result.every((m) => !m.risky)).toBe(true);
    expect(result.every((m) => m.requiredMonthlyProvision === null)).toBe(true);
  });

  it("signale un mois à risque quand une dépense anticipée fait dépasser le revenu", () => {
    const result = computeRiskyMonths(3000, 2900, [
      { year: 2026, month: 10, anticipatedExpenses: 0 },
      { year: 2026, month: 11, anticipatedExpenses: 1100 },
    ]);
    expect(result[0].risky).toBe(false);
    expect(result[1].risky).toBe(true);
    expect(result[1].projectedCharges).toBe(4000);
    expect(result[1].shortfall).toBe(1000);
    // 2 mois avant novembre (index 1 => monthsUntil = 2) : 1000 / 2 = 500
    expect(result[1].requiredMonthlyProvision).toBe(500);
  });

  it("un déficit structurel (charges > revenu dès le départ) reste signalé chaque mois", () => {
    const result = computeRiskyMonths(2000, 2200, [{ year: 2026, month: 10, anticipatedExpenses: 0 }]);
    expect(result[0].risky).toBe(true);
    expect(result[0].shortfall).toBe(200);
    expect(result[0].requiredMonthlyProvision).toBe(200);
  });

  it("arrondit proprement les montants décimaux", () => {
    const result = computeRiskyMonths(1000, 1000, [{ year: 2026, month: 10, anticipatedExpenses: 100.004 }]);
    expect(result[0].projectedCharges).toBe(1100);
  });
});
