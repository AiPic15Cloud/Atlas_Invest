import type { BudgetCategory } from "@prisma/client";

export function normalizePosteKey(poste: string): string {
  return poste.trim().toLowerCase();
}

// Mots-cles associes a des achats impulsifs / a faible valeur percue,
// suggeres automatiquement comme "regrettes" avant toute correction de
// l'utilisateur.
const REGRET_KEYWORDS = [
  "uber eats",
  "deliveroo",
  "just eat",
  "mcdonald",
  "quick",
  "burger king",
  "kfc",
  "starbucks",
  "bonbons",
  "confiserie",
  "tabac",
  "cigarette",
  "vapote",
  "loto",
  "loterie",
  "fdj",
  "pmu",
  "paris sportifs",
  "in-app",
  "app store",
  "google play",
  "loot box",
  "distributeur",
];

/**
 * Suggestion automatique de ressenti (V1) : mots-cles connus, ou petit achat
 * "envie" (faible montant, non essentiel) — typiquement un achat impulsif.
 * Ne suggere que le regret : dans tous les autres cas la depense reste non
 * evaluee (null) tant que l'utilisateur ne choisit pas explicitement un
 * ressenti, plutot que de lui preter une satisfaction qu'on ne peut pas
 * deviner. Affinee ensuite par les corrections de l'utilisateur (voir
 * FeelingRule).
 */
export function computeAutoFeeling(poste: string, amount: number, category: BudgetCategory): "REGRET" | null {
  const lower = poste.toLowerCase();
  if (REGRET_KEYWORDS.some((kw) => lower.includes(kw))) return "REGRET";
  if (category === "ENVIES" && amount > 0 && amount <= 15) return "REGRET";
  return null;
}
