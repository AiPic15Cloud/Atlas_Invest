// Revenus variables (section 62) : "revenu moyen" et "revenu prudent" pour
// budgetiser une source de revenu irreguliere (freelance, commissions...).
// Le revenu prudent est le minimum reellement observe sur la fenetre, jamais
// une extrapolation statistique (percentile, ecart-type...) qui inventerait
// une certitude que les donnees ne donnent pas (garde-fou section 78).
export interface VariableIncomeStats {
  average: number;
  conservative: number;
  observedMonths: number;
}

export function computeVariableIncomeStats(amounts: number[]): VariableIncomeStats | null {
  if (amounts.length === 0) return null;
  const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const conservative = Math.min(...amounts);
  return {
    average: Math.round(average * 100) / 100,
    conservative: Math.round(conservative * 100) / 100,
    observedMonths: amounts.length,
  };
}
