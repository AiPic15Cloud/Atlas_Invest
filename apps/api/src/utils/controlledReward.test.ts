import { describe, expect, it } from "vitest";
import { computeControlledReward } from "./controlledReward.js";

describe("computeControlledReward", () => {
  it("reproduit l'exemple exact de la spec (600 -> 800, 10% -> 20€ plaisir / 180€ épargne)", () => {
    const result = computeControlledReward(600, 800, 10);
    expect(result).not.toBeNull();
    expect(result!.overshoot).toBe(200);
    expect(result!.funBudget).toBe(20);
    expect(result!.extraSavings).toBe(180);
  });

  it("retourne null si l'objectif n'est pas dépassé", () => {
    expect(computeControlledReward(600, 600, 10)).toBeNull();
    expect(computeControlledReward(600, 500, 10)).toBeNull();
  });

  it("les deux parts somment toujours exactement au dépassement, même avec un pourcentage qui arrondit mal", () => {
    const result = computeControlledReward(100, 133.33, 33)!;
    expect(Math.round((result.funBudget + result.extraSavings) * 100) / 100).toBe(result.overshoot);
  });

  it("accepte un pourcentage de 100 (tout en plaisir) ou 0 (tout en épargne)", () => {
    const allFun = computeControlledReward(600, 800, 100)!;
    expect(allFun.funBudget).toBe(200);
    expect(allFun.extraSavings).toBe(0);

    const allSavings = computeControlledReward(600, 800, 0)!;
    expect(allSavings.funBudget).toBe(0);
    expect(allSavings.extraSavings).toBe(200);
  });
});
