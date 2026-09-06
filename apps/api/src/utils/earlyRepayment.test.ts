import { describe, expect, it } from "vitest";
import { simulateEarlyRepayment } from "./earlyRepayment.js";

const NOW = new Date(2026, 8, 6);

describe("simulateEarlyRepayment", () => {
  it("réduit le capital restant dû et raccourcit la durée restante", () => {
    const result = simulateEarlyRepayment(
      { id: "1", label: "Prêt conso", principalAmount: 5000, remainingBalance: 3000, monthlyPayment: 200, interestRate: null, endDate: null },
      1000,
      NOW,
    );
    expect(result.newRemainingBalance).toBe(2000);
    expect(result.before.monthsRemaining).toBe(15);
    expect(result.after.monthsRemaining).toBe(10);
    expect(result.monthsSaved).toBe(5);
  });

  it("calcule le gain d'intérêts quand le taux est connu", () => {
    const result = simulateEarlyRepayment(
      { id: "2", label: "Immo", principalAmount: 200000, remainingBalance: 100000, monthlyPayment: 900, interestRate: 3, endDate: null },
      5000,
      NOW,
    );
    expect(result.interestSaved).not.toBeNull();
    expect(result.interestSaved!).toBeGreaterThan(0);
  });

  it("ne peut pas estimer le gain d'intérêts si le taux est inconnu", () => {
    const result = simulateEarlyRepayment(
      { id: "3", label: "X", principalAmount: 5000, remainingBalance: 3000, monthlyPayment: 200, interestRate: null, endDate: null },
      500,
      NOW,
    );
    expect(result.interestSaved).toBeNull();
  });

  it("recalcule la date de fin après remboursement même si le prêt avait une date déclarée", () => {
    const declaredEnd = new Date(2030, 0, 1);
    const result = simulateEarlyRepayment(
      { id: "4", label: "Immo", principalAmount: 200000, remainingBalance: 100000, monthlyPayment: 900, interestRate: null, endDate: declaredEnd },
      50000,
      NOW,
    );
    expect(result.before.endDate).toEqual(declaredEnd);
    expect(result.after.endDate).not.toEqual(declaredEnd);
  });

  it("calcule une mensualité éventuelle réduite qui garde la même date de fin", () => {
    const result = simulateEarlyRepayment(
      { id: "6", label: "Prêt conso", principalAmount: 5000, remainingBalance: 3000, monthlyPayment: 200, interestRate: null, endDate: null },
      1000,
      NOW,
    );
    // Meme duree qu'avant (15 mois) mais sur 2000€ au lieu de 3000€ : 2000/15
    expect(result.reducedMonthlyPayment).toBeCloseTo(2000 / 15, 2);
    expect(result.reducedMonthlyPayment!).toBeLessThan(200);
  });

  it("un remboursement qui solde le prêt donne 0 mois restants après", () => {
    const result = simulateEarlyRepayment(
      { id: "5", label: "Petit prêt", principalAmount: 1000, remainingBalance: 800, monthlyPayment: 100, interestRate: null, endDate: null },
      1000,
      NOW,
    );
    expect(result.newRemainingBalance).toBe(0);
    expect(result.after.monthsRemaining).toBe(0);
  });
});
