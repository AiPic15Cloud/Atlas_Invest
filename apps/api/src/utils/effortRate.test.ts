import { describe, expect, it } from "vitest";
import { computeEffortRate } from "./effortRate.js";

describe("computeEffortRate", () => {
  it("calcule le taux d'effort actuel et après projet", () => {
    const result = computeEffortRate({
      monthlyIncome: 3000,
      existingMonthlyDebt: 500,
      newMonthlyPayment: 550,
    });
    expect(result.currentRatePercent).toBeCloseTo(16.67, 1);
    expect(result.afterRatePercent).toBeCloseTo(35, 1);
  });

  it("reproduit l'exemple de la spec (24,7 % -> 34,3 %)", () => {
    const result = computeEffortRate({
      monthlyIncome: 4000,
      existingMonthlyDebt: 988,
      newMonthlyPayment: 384,
    });
    expect(result.currentRatePercent).toBeCloseTo(24.7, 1);
    expect(result.afterRatePercent).toBeCloseTo(34.3, 1);
  });

  it("utilise 35 % comme référence par défaut", () => {
    const result = computeEffortRate({ monthlyIncome: 3000, existingMonthlyDebt: 0, newMonthlyPayment: 0 });
    expect(result.referenceRatePercent).toBe(35);
  });

  it("accepte une référence personnalisée", () => {
    const result = computeEffortRate({
      monthlyIncome: 3000,
      existingMonthlyDebt: 0,
      newMonthlyPayment: 0,
      referenceRatePercent: 33,
    });
    expect(result.referenceRatePercent).toBe(33);
  });

  it("est non disponible sans revenu renseigné, plutôt que de diviser par zéro", () => {
    const result = computeEffortRate({ monthlyIncome: 0, existingMonthlyDebt: 500, newMonthlyPayment: 300 });
    expect(result.currentRatePercent).toBeNull();
    expect(result.afterRatePercent).toBeNull();
    expect(result.unavailableReason).toMatch(/revenu/);
  });
});
