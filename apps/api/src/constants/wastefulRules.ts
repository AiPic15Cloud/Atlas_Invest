export function normalizePosteKey(poste: string): string {
  return poste.trim().toLowerCase();
}

// Mots-cles associes a des achats impulsifs / a faible valeur percue.
const WASTEFUL_KEYWORDS = [
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
 * Regle par defaut (V1) : mots-cles connus, ou petit achat "envie" (faible
 * montant, non essentiel) — typiquement un achat impulsif. Affinee ensuite
 * par les corrections de l'utilisateur (voir WastefulRule).
 */
export function computeAutoWasteful(poste: string, amount: number, category: "BESOINS" | "ENVIES" | "EPARGNE"): boolean {
  const lower = poste.toLowerCase();
  if (WASTEFUL_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (category === "ENVIES" && amount > 0 && amount <= 15) return true;
  return false;
}
