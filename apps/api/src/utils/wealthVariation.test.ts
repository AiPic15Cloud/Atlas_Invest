import { describe, expect, it } from "vitest";
import { computeWealthVariationBreakdown } from "./wealthVariation.js";

describe("computeWealthVariationBreakdown", () => {
  it("attribue le reste au solde à expliquer quand les flux ne couvrent pas toute la variation", () => {
    const result = computeWealthVariationBreakdown({
      totalVariation: 820,
      epargne: 300,
      investissement: 200,
      capitalRembourse: 250,
    });
    expect(result.unexplained).toBe(70);
  });

  it("un solde à expliquer négatif signale une perte de valeur malgré les apports", () => {
    const result = computeWealthVariationBreakdown({
      totalVariation: 400,
      epargne: 300,
      investissement: 200,
      capitalRembourse: 0,
    });
    expect(result.unexplained).toBe(-100);
  });

  it("aucun flux mesurable -> tout l'écart est à expliquer", () => {
    const result = computeWealthVariationBreakdown({
      totalVariation: 70,
      epargne: 0,
      investissement: 0,
      capitalRembourse: 0,
    });
    expect(result.unexplained).toBe(70);
  });

  it("flux exactement égaux à la variation totale -> rien à expliquer", () => {
    const result = computeWealthVariationBreakdown({
      totalVariation: 550,
      epargne: 300,
      investissement: 0,
      capitalRembourse: 250,
    });
    expect(result.unexplained).toBe(0);
  });
});
