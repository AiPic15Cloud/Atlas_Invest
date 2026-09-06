import { describe, expect, it } from "vitest";
import { simulateFinancing } from "./financingSimulator.js";

describe("simulateFinancing", () => {
  it("calcule le montant financé comme montant moins apport", () => {
    const result = simulateFinancing({
      amount: 20000,
      downPayment: 5000,
      durationMonths: 48,
      interestRatePercent: 0,
    });
    expect(result.financedAmount).toBe(15000);
  });

  it("à taux 0, la mensualité est le montant financé divisé par la durée", () => {
    const result = simulateFinancing({
      amount: 12000,
      downPayment: 0,
      durationMonths: 24,
      interestRatePercent: 0,
    });
    expect(result.monthlyPayment).toBeCloseTo(500, 2);
    expect(result.totalInterest).toBeCloseTo(0, 2);
  });

  it("calcule une mensualité amortie cohérente pour un prêt immobilier classique", () => {
    // 200 000 € sur 20 ans (240 mois) à 3%/an -> mensualité connue ~1109€
    const result = simulateFinancing({
      amount: 200000,
      downPayment: 0,
      durationMonths: 240,
      interestRatePercent: 3,
    });
    expect(result.monthlyPayment).toBeGreaterThan(1100);
    expect(result.monthlyPayment).toBeLessThan(1120);
    expect(result.totalInterest).toBeGreaterThan(60000);
  });

  it("TAEG non disponible si le taux d'intérêt n'est pas renseigné", () => {
    const result = simulateFinancing({
      amount: 10000,
      downPayment: 0,
      durationMonths: 36,
      interestRatePercent: null,
    });
    expect(result.taeg).toBeNull();
    expect(result.taegUnavailableReason).toMatch(/taux d'intérêt/);
  });

  it("TAEG non disponible si l'assurance ou les frais ne sont pas renseignés, même avec un taux connu", () => {
    const result = simulateFinancing({
      amount: 10000,
      downPayment: 0,
      durationMonths: 36,
      interestRatePercent: 4,
      // insuranceMonthly et fees volontairement omis (undefined, pas 0)
    });
    expect(result.taeg).toBeNull();
    expect(result.taegUnavailableReason).toMatch(/assurance et\/ou frais/);
  });

  it("calcule un TAEG estimé dès que assurance et frais sont explicitement renseignés, même à 0", () => {
    const result = simulateFinancing({
      amount: 10000,
      downPayment: 0,
      durationMonths: 36,
      interestRatePercent: 4,
      insuranceMonthly: 0,
      fees: 0,
    });
    expect(result.taeg).not.toBeNull();
    expect(result.taegUnavailableReason).toBeNull();
    // Sans assurance ni frais, le TAEG doit rester proche du taux nominal
    // (legerement superieur du fait de la composition mensuelle).
    expect(result.taeg!).toBeGreaterThan(4);
    expect(result.taeg!).toBeLessThan(4.2);
  });

  it("le TAEG augmente avec l'ajout de frais et d'assurance à taux nominal égal", () => {
    const base = simulateFinancing({
      amount: 10000,
      downPayment: 0,
      durationMonths: 36,
      interestRatePercent: 4,
      insuranceMonthly: 0,
      fees: 0,
    });
    const withCosts = simulateFinancing({
      amount: 10000,
      downPayment: 0,
      durationMonths: 36,
      interestRatePercent: 4,
      insuranceMonthly: 15,
      fees: 300,
    });
    expect(withCosts.taeg!).toBeGreaterThan(base.taeg!);
  });

  it("inclut l'assurance et les frais dans le coût total mais pas dans les intérêts", () => {
    const result = simulateFinancing({
      amount: 10000,
      downPayment: 0,
      durationMonths: 12,
      interestRatePercent: 2,
      insuranceMonthly: 10,
      fees: 100,
    });
    const expectedTotalCost = result.totalInterest + 100 + 10 * 12;
    expect(result.totalCost).toBeCloseTo(expectedTotalCost, 2);
  });
});
