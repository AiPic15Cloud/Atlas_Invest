// Mensualisation d'une depense annuelle previsible (spec section 17).
export function computeMonthlyProvision(annualAmount: number): number {
  return Math.round((annualAmount / 12) * 100) / 100;
}

export function sumMonthlyProvisions(annualAmounts: number[]): number {
  return annualAmounts.reduce((sum, amount) => sum + computeMonthlyProvision(amount), 0);
}
