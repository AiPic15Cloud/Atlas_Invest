import { describe, expect, it } from "vitest";
import { computeRealDisposableIncome } from "./realDisposableIncome.js";

describe("computeRealDisposableIncome", () => {
  it("reproduit l'exemple exact de la spec (2 600 € - 2 250 € = 350 €/mois)", () => {
    const result = computeRealDisposableIncome({
      monthlyIncome: 3200,
      existingMonthlyDebt: 0,
      newMonthlyPayment: 600,
      observedMonthlyExpenses: 2250,
    });
    expect(result.theoreticalRemainderAfterCredit).toBe(2600);
    expect(result.observedMonthlyExpenses).toBe(2250);
    expect(result.realMargin).toBe(350);
  });

  it("une marge négative signale que le train de vie observé dépasse le reste théorique", () => {
    const result = computeRealDisposableIncome({
      monthlyIncome: 3000,
      existingMonthlyDebt: 200,
      newMonthlyPayment: 500,
      observedMonthlyExpenses: 2500,
    });
    expect(result.theoreticalRemainderAfterCredit).toBe(2300);
    expect(result.realMargin).toBe(-200);
  });

  it("est non disponible sans revenu renseigné", () => {
    const result = computeRealDisposableIncome({
      monthlyIncome: 0,
      existingMonthlyDebt: 0,
      newMonthlyPayment: 500,
      observedMonthlyExpenses: 2000,
    });
    expect(result.theoreticalRemainderAfterCredit).toBeNull();
    expect(result.realMargin).toBeNull();
    expect(result.unavailableReason).toMatch(/revenu/);
  });
});
