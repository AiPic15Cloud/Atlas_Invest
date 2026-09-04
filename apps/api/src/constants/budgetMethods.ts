export type BudgetMethodKey =
  | "CONFORTABLE_50_30_20"
  | "TENDUE_60_25_15"
  | "TRES_TENDUE_70_20_10"
  | "BASE_ZERO"
  | "QUATRE_VINGT_VINGT"
  | "CASCADES_3";

type FixedSplit = {
  splitMode: "FIXED";
  label: string;
  description: string;
  besoinsPct: number;
  enviesPct: number;
  epargnePct: number;
};

type CascadeSplit = {
  splitMode: "CASCADE";
  label: string;
  description: string;
  besoinsPct: number;
  epargnePct: number;
};

type ZeroBasedSplit = {
  splitMode: "ZERO_BASED";
  label: string;
  description: string;
};

type MethodDefinition = FixedSplit | CascadeSplit | ZeroBasedSplit;

export const BUDGET_METHODS: Record<BudgetMethodKey, MethodDefinition> = {
  CONFORTABLE_50_30_20: {
    splitMode: "FIXED",
    label: "50/30/20 — Confortable",
    description: "50 % besoins, 30 % envies, 20 % épargne. La répartition la plus courante quand le budget respire.",
    besoinsPct: 50,
    enviesPct: 30,
    epargnePct: 20,
  },
  TENDUE_60_25_15: {
    splitMode: "FIXED",
    label: "60/25/15 — Tendue",
    description: "60 % besoins, 25 % envies, 15 % épargne. Pour un budget plus serré.",
    besoinsPct: 60,
    enviesPct: 25,
    epargnePct: 15,
  },
  TRES_TENDUE_70_20_10: {
    splitMode: "FIXED",
    label: "70/20/10 — Très tendue",
    description: "70 % besoins, 20 % envies, 10 % épargne. Quand les charges fixes pèsent lourd.",
    besoinsPct: 70,
    enviesPct: 20,
    epargnePct: 10,
  },
  QUATRE_VINGT_VINGT: {
    splitMode: "FIXED",
    label: "80/20",
    description:
      "20 % épargne prélevée d'abord, 80 % pour vivre — réparti ici en 55 % besoins et 25 % envies à titre indicatif.",
    besoinsPct: 55,
    enviesPct: 25,
    epargnePct: 20,
  },
  CASCADES_3: {
    splitMode: "CASCADE",
    label: "Budget en 3 cascades",
    description:
      "Les besoins (50 %) puis l'épargne (20 %) sont prélevés en premier ; les envies récupèrent ce qu'il reste.",
    besoinsPct: 50,
    epargnePct: 20,
  },
  BASE_ZERO: {
    splitMode: "ZERO_BASED",
    label: "Base zéro",
    description:
      "Chaque euro est affecté à un poste : pas de pourcentage imposé, l'objectif est un reste à vivre à 0.",
  },
};

export interface BudgetBreakdown {
  besoinsTarget: number;
  enviesTarget: number;
  epargneTarget: number;
  besoinsActual: number;
  enviesActual: number;
  epargneActual: number;
  resteAVivre: number;
  capaciteEpargne: number;
}

export function computeBudgetBreakdown(
  method: BudgetMethodKey,
  monthlyIncome: number,
  actual: { besoins: number; envies: number; epargne: number },
): BudgetBreakdown {
  const def = BUDGET_METHODS[method];

  let besoinsTarget: number;
  let enviesTarget: number;
  let epargneTarget: number;

  if (def.splitMode === "FIXED") {
    besoinsTarget = (monthlyIncome * def.besoinsPct) / 100;
    enviesTarget = (monthlyIncome * def.enviesPct) / 100;
    epargneTarget = (monthlyIncome * def.epargnePct) / 100;
  } else if (def.splitMode === "CASCADE") {
    besoinsTarget = (monthlyIncome * def.besoinsPct) / 100;
    epargneTarget = (monthlyIncome * def.epargnePct) / 100;
    enviesTarget = monthlyIncome - besoinsTarget - epargneTarget;
  } else {
    besoinsTarget = actual.besoins;
    enviesTarget = actual.envies;
    epargneTarget = actual.epargne;
  }

  const resteAVivre = monthlyIncome - besoinsTarget;
  const capaciteEpargne = epargneTarget;

  return {
    besoinsTarget,
    enviesTarget,
    epargneTarget,
    besoinsActual: actual.besoins,
    enviesActual: actual.envies,
    epargneActual: actual.epargne,
    resteAVivre,
    capaciteEpargne,
  };
}
