import { describe, expect, it } from "vitest";
import { computeDecisionRealCost } from "./decisionCost.js";

describe("computeDecisionRealCost", () => {
  it("additionne tous les composants, comme l'exemple voiture de la spec", () => {
    const total = computeDecisionRealCost([
      { monthlyAmount: 280 },
      { monthlyAmount: 70 },
      { monthlyAmount: 140 },
      { monthlyAmount: 50 },
    ]);
    expect(total).toBe(540);
  });

  it("aucun composant -> coût nul", () => {
    expect(computeDecisionRealCost([])).toBe(0);
  });

  it("arrondit proprement les centimes", () => {
    const total = computeDecisionRealCost([{ monthlyAmount: 33.333 }, { monthlyAmount: 10.001 }]);
    expect(total).toBe(43.33);
  });
});
