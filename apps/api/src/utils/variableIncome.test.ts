import { describe, expect, it } from "vitest";
import { computeVariableIncomeStats } from "./variableIncome.js";

describe("computeVariableIncomeStats", () => {
  it("calcule la moyenne et le minimum réellement observé", () => {
    const result = computeVariableIncomeStats([1000, 1500, 800, 1200]);
    expect(result).not.toBeNull();
    expect(result!.average).toBe(1125);
    expect(result!.conservative).toBe(800);
    expect(result!.observedMonths).toBe(4);
  });

  it("retourne null sans aucune donnée, plutôt que d'inventer un chiffre", () => {
    expect(computeVariableIncomeStats([])).toBeNull();
  });

  it("avec un seul mois observé, moyenne et prudent sont égaux à ce mois", () => {
    const result = computeVariableIncomeStats([950])!;
    expect(result.average).toBe(950);
    expect(result.conservative).toBe(950);
    expect(result.observedMonths).toBe(1);
  });

  it("le revenu prudent n'est jamais un percentile ou une extrapolation, seulement le minimum réel", () => {
    const result = computeVariableIncomeStats([2000, 100, 2000, 2000, 2000])!;
    expect(result.conservative).toBe(100);
  });
});
