import { describe, expect, it } from "vitest";
import { computeDebtCockpit, projectLoan } from "./debtCockpit.js";

const NOW = new Date(2026, 8, 6); // 6 septembre 2026

describe("projectLoan", () => {
  it("estime la fin sans taux connu (division simple), comme l'exemple de la spec (9 mois)", () => {
    const result = projectLoan(
      { id: "1", label: "Crédit auto", principalAmount: 10000, remainingBalance: 2790, monthlyPayment: 310, interestRate: null, endDate: null },
      NOW,
    );
    expect(result.monthsRemaining).toBe(9);
    expect(result.estimatedRemainingInterest).toBeNull();
    expect(result.endDate).toEqual(new Date(2027, 5, 6));
  });

  it("estime les intérêts restants quand le taux est connu", () => {
    const result = projectLoan(
      { id: "2", label: "Prêt conso", principalAmount: 5000, remainingBalance: 1000, monthlyPayment: 100, interestRate: 6, endDate: null },
      NOW,
    );
    expect(result.monthsRemaining).toBeGreaterThan(0);
    expect(result.estimatedRemainingInterest).not.toBeNull();
    expect(result.estimatedRemainingInterest!).toBeGreaterThan(0);
  });

  it("signale qu'un prêt ne sera jamais remboursé si la mensualité ne couvre pas les intérêts", () => {
    const result = projectLoan(
      { id: "3", label: "Prêt bloqué", principalAmount: 10000, remainingBalance: 10000, monthlyPayment: 10, interestRate: 12, endDate: null },
      NOW,
    );
    expect(result.neverPaysOff).toBe(true);
    expect(result.monthsRemaining).toBeNull();
  });

  it("un prêt déjà soldé a 0 mois restants et 0 intérêt", () => {
    const result = projectLoan(
      { id: "4", label: "Soldé", principalAmount: 5000, remainingBalance: 0, monthlyPayment: 100, interestRate: 3, endDate: null },
      NOW,
    );
    expect(result.monthsRemaining).toBe(0);
    expect(result.estimatedRemainingInterest).toBe(0);
  });

  it("respecte une date de fin déjà déclarée plutôt que de la recalculer", () => {
    const declaredEnd = new Date(2028, 0, 1);
    const result = projectLoan(
      { id: "5", label: "Immo", principalAmount: 200000, remainingBalance: 150000, monthlyPayment: 900, interestRate: 2, endDate: declaredEnd },
      NOW,
    );
    expect(result.endDate).toEqual(declaredEnd);
  });
});

describe("computeDebtCockpit", () => {
  it("agrège plusieurs prêts et trouve la prochaine mensualité libérée", () => {
    const result = computeDebtCockpit(
      [
        { id: "1", label: "Crédit auto", principalAmount: 10000, remainingBalance: 2790, monthlyPayment: 310, interestRate: null, endDate: null },
        { id: "2", label: "Immo", principalAmount: 200000, remainingBalance: 150000, monthlyPayment: 900, interestRate: null, endDate: null },
      ],
      NOW,
      3000,
    );
    expect(result.totalDebt).toBe(210000);
    expect(result.totalRemainingBalance).toBe(152790);
    expect(result.totalMonthlyPayments).toBe(1210);
    expect(result.incomeShare).toBeCloseTo(1210 / 3000);
    expect(result.nextFreedPayment?.loanId).toBe("1");
    expect(result.nextFreedPayment?.amount).toBe(310);
  });

  it("ne calcule pas de part de revenu si le revenu récurrent est nul", () => {
    const result = computeDebtCockpit(
      [{ id: "1", label: "X", principalAmount: 1000, remainingBalance: 500, monthlyPayment: 50, interestRate: null, endDate: null }],
      NOW,
      0,
    );
    expect(result.incomeShare).toBeNull();
  });

  it("aucun prêt -> synthèse à zéro sans erreur", () => {
    const result = computeDebtCockpit([], NOW, 3000);
    expect(result.totalDebt).toBe(0);
    expect(result.nextFreedPayment).toBeNull();
  });
});
