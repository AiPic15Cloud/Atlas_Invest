// Recompense controlee (section 57) : quand l'epargne reelle du mois
// depasse l'objectif du defi mensuel, une part configurable du depassement
// devient "budget plaisir" plutot que de l'epargne supplementaire -- le
// foyer choisit la regle, jamais une valeur imposee par l'app.
export interface ControlledRewardResult {
  overshoot: number;
  funBudget: number;
  extraSavings: number;
}

export function computeControlledReward(
  targetAmount: number,
  saved: number,
  rewardPercent: number,
): ControlledRewardResult | null {
  const overshoot = Math.round((saved - targetAmount) * 100) / 100;
  if (overshoot <= 0) return null;

  // Le budget plaisir est arrondi en premier, puis l'epargne supplementaire
  // est le reste exact (overshoot - funBudget) plutot que son propre calcul
  // arrondi separement : les deux parts sommeront toujours exactement au
  // depassement, sans centime perdu ou invente par un double arrondi.
  const funBudget = Math.round(overshoot * (rewardPercent / 100) * 100) / 100;
  const extraSavings = Math.round((overshoot - funBudget) * 100) / 100;

  return { overshoot, funBudget, extraSavings };
}
