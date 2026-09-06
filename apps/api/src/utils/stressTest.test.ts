import { describe, expect, it } from "vitest";
import { simulateStressTest } from "./stressTest.js";

describe("simulateStressTest", () => {
  it("perte d'un revenu : calcule combien de mois le foyer peut absorber le choc", () => {
    const result = simulateStressTest(3200, 3000, 2000, { type: "INCOME_LOSS", monthlyAmount: 1000 });
    // Nouveau revenu 2200, depenses 3000 -> deficit de 800/mois ; 2000/800 = 2.5 -> 2 mois pleins
    expect(result.newMonthlyIncome).toBe(2200);
    expect(result.newMonthlyBalance).toBe(-800);
    expect(result.monthsSustainable).toBe(2);
    expect(result.sustainableIndefinitely).toBe(false);
  });

  it("baisse de revenu en pourcentage", () => {
    const result = simulateStressTest(3000, 2500, 5000, { type: "INCOME_DROP_PERCENT", percent: 30 });
    expect(result.newMonthlyIncome).toBe(2100);
    expect(result.newMonthlyBalance).toBe(-400);
    expect(result.monthsSustainable).toBe(12);
  });

  it("dépense imprévue ponctuelle : ampute directement le tampon disponible", () => {
    const result = simulateStressTest(3000, 2500, 5000, { type: "ONE_OFF_EXPENSE", amount: 2500 });
    expect(result.bufferAfterShock).toBe(2500);
    // Le rythme mensuel courant reste positif (+500), donc soutenable indefiniment
    expect(result.sustainableIndefinitely).toBe(true);
  });

  it("hausse d'une charge récurrente (ex. loyer)", () => {
    const result = simulateStressTest(3000, 2900, 1000, { type: "RECURRING_EXPENSE_INCREASE", monthlyAmount: 200 });
    expect(result.newMonthlyExpenses).toBe(3100);
    expect(result.newMonthlyBalance).toBe(-100);
    expect(result.monthsSustainable).toBe(10);
  });

  it("un rythme mensuel qui reste positif est soutenable indéfiniment", () => {
    const result = simulateStressTest(3000, 1000, 500, { type: "INCOME_LOSS", monthlyAmount: 500 });
    expect(result.newMonthlyBalance).toBe(1500);
    expect(result.sustainableIndefinitely).toBe(true);
    expect(result.monthsSustainable).toBeNull();
  });

  it("aucun tampon disponible face à un déficit -> 0 mois, jamais négatif", () => {
    const result = simulateStressTest(1000, 2000, 0, { type: "INCOME_LOSS", monthlyAmount: 0 });
    expect(result.monthsSustainable).toBe(0);
  });

  it("un tampon déjà épuisé par la dépense ponctuelle ne redevient jamais négatif dans le calcul de mois", () => {
    const result = simulateStressTest(1000, 1200, 100, { type: "ONE_OFF_EXPENSE", amount: 500 });
    expect(result.bufferAfterShock).toBe(-400);
    expect(result.monthsSustainable).toBe(0);
  });
});
