import { describe, expect, it } from "vitest";
import { computeSurplusAllocation } from "./surplusAllocation.js";

describe("computeSurplusAllocation", () => {
  it("remplit le premier objectif jusqu'à sa mensualité prévue, puis passe au suivant", () => {
    const result = computeSurplusAllocation(300, [
      { id: "securite", remaining: 1000, monthlyContribution: 200 },
      { id: "voyage", remaining: 500, monthlyContribution: 100 },
    ]);
    expect(result.allocations).toEqual([
      { goalId: "securite", amount: 200 },
      { goalId: "voyage", amount: 100 },
    ]);
    expect(result.leftover).toBe(0);
  });

  it("signale le surplus restant une fois tous les objectifs couverts", () => {
    const result = computeSurplusAllocation(1000, [{ id: "securite", remaining: 200, monthlyContribution: 100 }]);
    expect(result.allocations).toEqual([{ goalId: "securite", amount: 100 }]);
    expect(result.leftover).toBe(900);
  });

  it("sans mensualité prévue, alloue jusqu'au montant restant de l'objectif", () => {
    const result = computeSurplusAllocation(1000, [{ id: "apport", remaining: 300, monthlyContribution: null }]);
    expect(result.allocations).toEqual([{ goalId: "apport", amount: 300 }]);
    expect(result.leftover).toBe(700);
  });

  it("ignore un objectif déjà atteint (remaining <= 0)", () => {
    const result = computeSurplusAllocation(200, [
      { id: "atteint", remaining: 0, monthlyContribution: 50 },
      { id: "voyage", remaining: 500, monthlyContribution: 100 },
    ]);
    expect(result.allocations).toEqual([{ goalId: "voyage", amount: 100 }]);
    expect(result.leftover).toBe(100);
  });

  it("aucun surplus disponible : aucune allocation", () => {
    const result = computeSurplusAllocation(0, [{ id: "securite", remaining: 500, monthlyContribution: 100 }]);
    expect(result.allocations).toEqual([]);
    expect(result.leftover).toBe(0);
  });
});
