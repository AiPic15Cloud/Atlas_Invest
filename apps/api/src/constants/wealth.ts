export type WealthCategoryKey = "IMMOBILIER" | "VEHICULE" | "PLACEMENT" | "AUTRE_ACTIF" | "CREDIT" | "AUTRE_DETTE";

export const WEALTH_CATEGORIES: Record<WealthCategoryKey, { label: string; kind: "ASSET" | "LIABILITY" }> = {
  IMMOBILIER: { label: "Immobilier", kind: "ASSET" },
  VEHICULE: { label: "Véhicule", kind: "ASSET" },
  PLACEMENT: { label: "Placement / épargne", kind: "ASSET" },
  AUTRE_ACTIF: { label: "Autre actif", kind: "ASSET" },
  CREDIT: { label: "Crédit", kind: "LIABILITY" },
  AUTRE_DETTE: { label: "Autre dette", kind: "LIABILITY" },
};

export function wealthItemSignedAmount(category: WealthCategoryKey, amount: number): number {
  return WEALTH_CATEGORIES[category].kind === "LIABILITY" ? -amount : amount;
}
