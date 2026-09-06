import { describe, expect, it } from "vitest";
import { computeChallengeProgress } from "./monthlyChallenge.js";

describe("computeChallengeProgress", () => {
  it("calcule le reste à épargner tant que la cible n'est pas atteinte", () => {
    const result = computeChallengeProgress(600, null, 362);
    expect(result.remaining).toBe(238);
    expect(result.achieved).toBe(false);
    expect(result.stretchReached).toBe(false);
  });

  it("signale la cible atteinte sans stretch goal défini", () => {
    const result = computeChallengeProgress(600, null, 600);
    expect(result.achieved).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.stretchReached).toBe(false);
  });

  it("signale le stretch goal atteint quand l'épargne le dépasse", () => {
    const result = computeChallengeProgress(600, 750, 812);
    expect(result.achieved).toBe(true);
    expect(result.stretchReached).toBe(true);
  });

  it("ne descend jamais sous zéro même si l'épargne dépasse largement la cible", () => {
    const result = computeChallengeProgress(600, null, 1000);
    expect(result.remaining).toBe(0);
  });
});
