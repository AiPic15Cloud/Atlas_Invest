// Cockpit dette (section 35) : projette, pour chaque prêt, la date de fin et
// les intérêts restants à partir du capital restant dû, de la mensualité et
// du taux — jamais une fausse précision quand le taux est inconnu (doctrine
// section 39, "TAEG non disponible" plutôt qu'un chiffre inventé).
export interface LoanForProjection {
  id: string;
  label: string;
  principalAmount: number;
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number | null;
  endDate: Date | null;
}

export interface LoanProjection {
  id: string;
  label: string;
  remainingBalance: number;
  monthlyPayment: number;
  monthsRemaining: number | null;
  endDate: Date | null;
  estimatedRemainingInterest: number | null;
  neverPaysOff: boolean;
}

function addMonths(from: Date, months: number): Date {
  return new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
}

export function projectLoan(loan: LoanForProjection, from: Date): LoanProjection {
  const base = {
    id: loan.id,
    label: loan.label,
    remainingBalance: loan.remainingBalance,
    monthlyPayment: loan.monthlyPayment,
  };

  if (loan.remainingBalance <= 0) {
    return { ...base, monthsRemaining: 0, endDate: from, estimatedRemainingInterest: 0, neverPaysOff: false };
  }
  if (loan.monthlyPayment <= 0) {
    return { ...base, monthsRemaining: null, endDate: null, estimatedRemainingInterest: null, neverPaysOff: true };
  }

  if (loan.interestRate === null || loan.interestRate === 0) {
    const monthsRemaining = Math.ceil(loan.remainingBalance / loan.monthlyPayment);
    return {
      ...base,
      monthsRemaining,
      endDate: loan.endDate ?? addMonths(from, monthsRemaining),
      estimatedRemainingInterest: null,
      neverPaysOff: false,
    };
  }

  const monthlyRate = loan.interestRate / 100 / 12;
  const monthlyInterest = loan.remainingBalance * monthlyRate;
  if (loan.monthlyPayment <= monthlyInterest) {
    return { ...base, monthsRemaining: null, endDate: null, estimatedRemainingInterest: null, neverPaysOff: true };
  }

  const monthsRemaining = Math.ceil(
    -Math.log(1 - (monthlyRate * loan.remainingBalance) / loan.monthlyPayment) / Math.log(1 + monthlyRate),
  );
  const estimatedRemainingInterest =
    Math.round((monthsRemaining * loan.monthlyPayment - loan.remainingBalance) * 100) / 100;

  return {
    ...base,
    monthsRemaining,
    endDate: loan.endDate ?? addMonths(from, monthsRemaining),
    estimatedRemainingInterest,
    neverPaysOff: false,
  };
}

export interface DebtCockpitSummary {
  totalDebt: number;
  totalRemainingBalance: number;
  totalMonthlyPayments: number;
  totalEstimatedRemainingInterest: number | null;
  hasUnknownInterest: boolean;
  incomeShare: number | null;
  nextFreedPayment: { loanId: string; label: string; endDate: Date; amount: number } | null;
  loans: LoanProjection[];
}

export function computeDebtCockpit(
  loans: LoanForProjection[],
  from: Date,
  monthlyRecurringIncome: number,
): DebtCockpitSummary {
  const projections = loans.map((l) => projectLoan(l, from));

  const totalDebt = loans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalRemainingBalance = loans.reduce((sum, l) => sum + l.remainingBalance, 0);
  const totalMonthlyPayments = loans.reduce((sum, l) => sum + l.monthlyPayment, 0);

  const knownInterest = projections.filter((p) => p.estimatedRemainingInterest !== null);
  const totalEstimatedRemainingInterest =
    knownInterest.length === projections.length
      ? Math.round(knownInterest.reduce((sum, p) => sum + p.estimatedRemainingInterest!, 0) * 100) / 100
      : null;
  const hasUnknownInterest = projections.some((p) => p.estimatedRemainingInterest === null && !p.neverPaysOff);

  const incomeShare = monthlyRecurringIncome > 0 ? totalMonthlyPayments / monthlyRecurringIncome : null;

  const finishing = projections
    .filter((p): p is LoanProjection & { endDate: Date } => p.endDate !== null && p.monthsRemaining !== null && p.monthsRemaining > 0)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  const nextFreedPayment =
    finishing.length > 0
      ? { loanId: finishing[0].id, label: finishing[0].label, endDate: finishing[0].endDate, amount: finishing[0].monthlyPayment }
      : null;

  return {
    totalDebt,
    totalRemainingBalance,
    totalMonthlyPayments,
    totalEstimatedRemainingInterest,
    hasUnknownInterest,
    incomeShare,
    nextFreedPayment,
    loans: projections,
  };
}
