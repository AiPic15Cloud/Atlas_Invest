// Ventilation d'une mensualité de prêt (spec section 34). Seule la part
// capital rembourse la dette ; intérêts et assurance sont consommés.
const ROUNDING_TOLERANCE = 0.01;

export interface LoanPaymentSplit {
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  insuranceAmount: number;
}

export function loanPaymentSplitIsValid(split: LoanPaymentSplit): boolean {
  if (split.principalAmount < 0 || split.interestAmount < 0 || split.insuranceAmount < 0) return false;
  const sum = split.principalAmount + split.interestAmount + split.insuranceAmount;
  return Math.abs(sum - split.totalAmount) <= ROUNDING_TOLERANCE;
}

// Le capital rembourse la dette (jamais plus que ce qu'il en reste) ;
// intérêts + assurance sont consommés, sans effet sur le capital restant dû.
export function applyLoanPayment(remainingBalance: number, principalAmount: number): number {
  return Math.max(remainingBalance - principalAmount, 0);
}
