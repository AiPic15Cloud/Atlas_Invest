import { describe, expect, it } from "vitest";
import { applyLoanPayment, loanPaymentSplitIsValid } from "./loanPayment.js";

describe("loanPaymentSplitIsValid", () => {
  it("accepte une répartition dont la somme égale le montant total", () => {
    expect(
      loanPaymentSplitIsValid({ totalAmount: 1200, principalAmount: 720, interestAmount: 420, insuranceAmount: 60 }),
    ).toBe(true);
  });

  it("accepte un paiement 100% capital (assurance et intérêts à 0)", () => {
    expect(
      loanPaymentSplitIsValid({ totalAmount: 500, principalAmount: 500, interestAmount: 0, insuranceAmount: 0 }),
    ).toBe(true);
  });

  it("rejette une répartition dont la somme ne correspond pas au montant total", () => {
    expect(
      loanPaymentSplitIsValid({ totalAmount: 1200, principalAmount: 720, interestAmount: 420, insuranceAmount: 0 }),
    ).toBe(false);
  });

  it("rejette une part négative", () => {
    expect(
      loanPaymentSplitIsValid({ totalAmount: 1200, principalAmount: 1250, interestAmount: -50, insuranceAmount: 0 }),
    ).toBe(false);
  });

  it("tolère un écart d'arrondi au centime", () => {
    expect(
      loanPaymentSplitIsValid({ totalAmount: 100, principalAmount: 33.33, interestAmount: 33.33, insuranceAmount: 33.34 }),
    ).toBe(true);
  });
});

describe("applyLoanPayment", () => {
  it("ne réduit le capital restant dû que du montant de la part capital, pas du total de la mensualité", () => {
    // Mensualité de 1200 € dont seulement 720 € de capital.
    expect(applyLoanPayment(10000, 720)).toBe(9280);
  });

  it("ne descend jamais sous zéro même si le capital versé dépasse le solde restant", () => {
    expect(applyLoanPayment(500, 720)).toBe(0);
  });
});
