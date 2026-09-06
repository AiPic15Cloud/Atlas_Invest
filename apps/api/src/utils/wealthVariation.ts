// Variation du patrimoine (section 31) : la performance des placements ne
// peut pas être isolée avec certitude des flux apportés sans historique de
// contribution par actif — plutôt que d'inventer un chiffre "performance"
// qui pourrait être faux, l'écart restant après les flux mesurables (épargne,
// investissement, capital immobilier remboursé) est présenté comme un solde
// "à expliquer", jamais caché ni faussement attribué (doctrine section 68).
export interface WealthVariationInput {
  totalVariation: number;
  epargne: number;
  investissement: number;
  capitalRembourse: number;
}

export interface WealthVariationBreakdown extends WealthVariationInput {
  unexplained: number;
}

export function computeWealthVariationBreakdown(input: WealthVariationInput): WealthVariationBreakdown {
  const explained = input.epargne + input.investissement + input.capitalRembourse;
  const unexplained = Math.round((input.totalVariation - explained) * 100) / 100;
  return { ...input, unexplained };
}
