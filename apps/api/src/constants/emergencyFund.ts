export type CriterionValue = 1 | 3 | 5;

export interface CriterionOption {
  value: CriterionValue;
  label: string;
}

export const CRITERIA: Record<string, { question: string; options: CriterionOption[] }> = {
  jobStability: {
    question: "Stabilité de l'emploi",
    options: [
      { value: 5, label: "CDI (ou statut équivalent), poste stable" },
      { value: 3, label: "CDD, intérim, période d'essai, freelance avec clients réguliers" },
      { value: 1, label: "Sans emploi ou activité très précaire" },
    ],
  },
  dependentsLoad: {
    question: "Charges familiales",
    options: [
      { value: 5, label: "Aucune personne à charge" },
      { value: 3, label: "1 à 2 personnes à charge" },
      { value: 1, label: "3 personnes à charge ou plus" },
    ],
  },
  health: {
    question: "Situation de santé",
    options: [
      { value: 5, label: "Bonne santé, pas de risque particulier" },
      { value: 3, label: "Quelques risques, plutôt gérés" },
      { value: 1, label: "Risque de santé significatif" },
    ],
  },
  alternativeIncome: {
    question: "Revenus alternatifs en cas de coup dur",
    options: [
      { value: 5, label: "Oui, source solide (conjoint qui travaille, revenus locatifs...)" },
      { value: 3, label: "Partielle ou incertaine" },
      { value: 1, label: "Aucune" },
    ],
  },
  debtLevel: {
    question: "Endettement actuel",
    options: [
      { value: 5, label: "Aucun crédit en cours" },
      { value: 3, label: "Crédit(s) gérable(s)" },
      { value: 1, label: "Endettement lourd" },
    ],
  },
};

export const CRITERIA_KEYS = Object.keys(CRITERIA) as (keyof typeof CRITERIA)[];

export function computeVulnerabilityScore(answers: Record<string, number>): number {
  const values = CRITERIA_KEYS.map((key) => answers[key]);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Score moyen de 1 (tres vulnerable) a 5 (tres stable) -> nombre de mois de depenses essentielles recommande. */
export function computeRecommendedMonths(score: number): number {
  if (score >= 4.5) return 3;
  if (score >= 3.5) return 4;
  if (score >= 2.5) return 6;
  if (score >= 1.5) return 8;
  return 9;
}
