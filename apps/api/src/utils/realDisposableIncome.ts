// Reste a vivre reel (section 45) : l'un des grands avantages d'Atlas selon
// la spec est de connaitre a la fois le reste theorique apres credit ET le
// train de vie reellement observe -- deux chiffres distincts qu'il ne faut
// jamais fondre en un seul, sous peine de masquer un ecart que
// l'utilisateur a justement besoin de voir.
export interface RealDisposableIncomeInput {
  monthlyIncome: number;
  existingMonthlyDebt: number;
  newMonthlyPayment: number;
  observedMonthlyExpenses: number;
}

export interface RealDisposableIncomeResult {
  theoreticalRemainderAfterCredit: number | null;
  observedMonthlyExpenses: number;
  realMargin: number | null;
  unavailableReason: string | null;
}

export function computeRealDisposableIncome(input: RealDisposableIncomeInput): RealDisposableIncomeResult {
  if (input.monthlyIncome <= 0) {
    return {
      theoreticalRemainderAfterCredit: null,
      observedMonthlyExpenses: Math.round(input.observedMonthlyExpenses * 100) / 100,
      realMargin: null,
      unavailableReason: "Reste à vivre réel non disponible : aucun revenu récurrent renseigné pour ce mois.",
    };
  }

  const theoreticalRemainderAfterCredit =
    Math.round((input.monthlyIncome - input.existingMonthlyDebt - input.newMonthlyPayment) * 100) / 100;
  const observedMonthlyExpenses = Math.round(input.observedMonthlyExpenses * 100) / 100;
  const realMargin = Math.round((theoreticalRemainderAfterCredit - observedMonthlyExpenses) * 100) / 100;

  return { theoreticalRemainderAfterCredit, observedMonthlyExpenses, realMargin, unavailableReason: null };
}
