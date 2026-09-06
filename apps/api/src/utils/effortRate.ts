// Taux d'effort (section 44) : jamais presente comme un seuil automatique
// d'acceptation bancaire (garde-fou section 78 : ne jamais donner une
// fausse certitude sur une decision qui appartient a la banque). La
// reference est configurable par l'utilisateur, avec 35 % comme valeur par
// defaut usuelle -- jamais un seuil "dur" impose par l'application.
export interface EffortRateInput {
  monthlyIncome: number;
  existingMonthlyDebt: number;
  newMonthlyPayment: number;
  referenceRatePercent?: number;
}

export interface EffortRateResult {
  currentRatePercent: number | null;
  afterRatePercent: number | null;
  referenceRatePercent: number;
  unavailableReason: string | null;
}

const DEFAULT_REFERENCE_RATE_PERCENT = 35;

export function computeEffortRate(input: EffortRateInput): EffortRateResult {
  const referenceRatePercent = input.referenceRatePercent ?? DEFAULT_REFERENCE_RATE_PERCENT;

  if (input.monthlyIncome <= 0) {
    return {
      currentRatePercent: null,
      afterRatePercent: null,
      referenceRatePercent,
      unavailableReason: "Taux d'effort non disponible : aucun revenu récurrent renseigné pour ce mois.",
    };
  }

  const currentRatePercent = Math.round((input.existingMonthlyDebt / input.monthlyIncome) * 10000) / 100;
  const afterRatePercent =
    Math.round(((input.existingMonthlyDebt + input.newMonthlyPayment) / input.monthlyIncome) * 10000) / 100;

  return { currentRatePercent, afterRatePercent, referenceRatePercent, unavailableReason: null };
}
