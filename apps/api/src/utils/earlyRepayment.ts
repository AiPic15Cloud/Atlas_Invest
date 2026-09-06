import { projectLoan, type LoanForProjection } from "./debtCockpit.js";

// Simulation de remboursement anticipé (section 36) : "Et si je rembourse
// 5 000 € maintenant ?" — jamais une action réelle, uniquement une
// comparaison avant/après sur le même prêt, mensualité inchangée.
export interface EarlyRepaymentProjection {
  monthsRemaining: number | null;
  endDate: Date | null;
  estimatedRemainingInterest: number | null;
  neverPaysOff: boolean;
}

export interface EarlyRepaymentResult {
  newRemainingBalance: number;
  before: EarlyRepaymentProjection;
  after: EarlyRepaymentProjection;
  interestSaved: number | null;
  monthsSaved: number | null;
  // Mensualite eventuelle (section 36) : l'alternative a raccourcir la duree
  // -- garder la meme date de fin que le scenario "avant" mais avec une
  // mensualite plus basse, calculee sur le nouveau capital restant du.
  reducedMonthlyPayment: number | null;
}

function computeAmortizedPayment(balance: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function simulateEarlyRepayment(
  loan: LoanForProjection,
  extraPayment: number,
  from: Date,
): EarlyRepaymentResult {
  const newRemainingBalance = Math.max(loan.remainingBalance - extraPayment, 0);

  const before = projectLoan(loan, from);
  // Une date de fin deja declaree sur le pret ne s'applique qu'au scenario
  // "avant" : le scenario "apres" doit toujours etre recalcule a partir du
  // nouveau capital restant du, jamais reprendre l'ancienne date figee.
  const after = projectLoan({ ...loan, remainingBalance: newRemainingBalance, endDate: null }, from);

  const interestSaved =
    before.estimatedRemainingInterest !== null && after.estimatedRemainingInterest !== null
      ? Math.round((before.estimatedRemainingInterest - after.estimatedRemainingInterest) * 100) / 100
      : null;
  const monthsSaved =
    before.monthsRemaining !== null && after.monthsRemaining !== null
      ? before.monthsRemaining - after.monthsRemaining
      : null;

  const reducedMonthlyPayment =
    before.monthsRemaining !== null && before.monthsRemaining > 0 && newRemainingBalance > 0
      ? Math.round(computeAmortizedPayment(newRemainingBalance, (loan.interestRate ?? 0) / 100 / 12, before.monthsRemaining) * 100) / 100
      : newRemainingBalance <= 0
        ? 0
        : null;

  return {
    newRemainingBalance,
    before: {
      monthsRemaining: before.monthsRemaining,
      endDate: before.endDate,
      estimatedRemainingInterest: before.estimatedRemainingInterest,
      neverPaysOff: before.neverPaysOff,
    },
    after: {
      monthsRemaining: after.monthsRemaining,
      endDate: after.endDate,
      estimatedRemainingInterest: after.estimatedRemainingInterest,
      neverPaysOff: after.neverPaysOff,
    },
    interestSaved,
    monthsSaved,
    reducedMonthlyPayment,
  };
}
