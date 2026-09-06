import { describe, expect, it } from "vitest";
import { isExcludedFromSubscriptionDetection } from "./subscriptionDetection.js";

describe("isExcludedFromSubscriptionDetection", () => {
  it("exclut le loyer et les virements d'épargne (comportement historique)", () => {
    expect(isExcludedFromSubscriptionDetection("Loyer appartement")).toBe(true);
    expect(isExcludedFromSubscriptionDetection("Virement épargne")).toBe(true);
    expect(isExcludedFromSubscriptionDetection("Virement epargne mensuel")).toBe(true);
  });

  it("exclut les postes de courses/alimentation courante", () => {
    expect(isExcludedFromSubscriptionDetection("Courses Carrefour")).toBe(true);
    expect(isExcludedFromSubscriptionDetection("Supermarché Leclerc")).toBe(true);
    expect(isExcludedFromSubscriptionDetection("Restaurant Le Bistrot")).toBe(true);
    expect(isExcludedFromSubscriptionDetection("Boulangerie du coin")).toBe(true);
    expect(isExcludedFromSubscriptionDetection("Marché du samedi")).toBe(true);
  });

  it("n'exclut pas un vrai abonnement", () => {
    expect(isExcludedFromSubscriptionDetection("Netflix")).toBe(false);
    expect(isExcludedFromSubscriptionDetection("Salle de sport")).toBe(false);
    expect(isExcludedFromSubscriptionDetection("Spotify Premium")).toBe(false);
    expect(isExcludedFromSubscriptionDetection("Assurance habitation")).toBe(false);
  });

  it("est insensible à la casse", () => {
    expect(isExcludedFromSubscriptionDetection("COURSES CASINO")).toBe(true);
  });
});
