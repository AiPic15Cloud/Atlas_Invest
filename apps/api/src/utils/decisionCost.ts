// Coût complet d'une décision (section 61) : additionne tous les
// composants d'un achat/engagement (crédit, assurance, carburant, entretien
// provisionné...) en un seul "coût réel" mensuel, pour ne jamais raisonner
// sur la seule mensualité de crédit qui sous-estime le coût véritable.
export interface DecisionCostItemInput {
  monthlyAmount: number;
}

export function computeDecisionRealCost(items: DecisionCostItemInput[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.monthlyAmount, 0) * 100) / 100;
}
