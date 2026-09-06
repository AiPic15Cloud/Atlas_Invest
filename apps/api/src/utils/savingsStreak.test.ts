import { describe, expect, it } from "vitest";
import { computeSavingsStreak } from "./savingsStreak.js";

function months(amounts: number[]): { year: number; month: number; amount: number }[] {
  return amounts.map((amount, i) => ({ year: 2026, month: i + 1, amount }));
}

describe("computeSavingsStreak", () => {
  it("compte la serie en cours quand tous les mois recents ont une epargne positive", () => {
    const result = computeSavingsStreak(months([0, 5, 10, 20]));
    expect(result.currentStreak).toBe(3);
  });

  it("une toute petite epargne maintient la serie", () => {
    const result = computeSavingsStreak(months([10, 20, 0.01]));
    expect(result.currentStreak).toBe(3);
  });

  it("un mois a zero brise la serie en cours mais garde le record passe", () => {
    const result = computeSavingsStreak(months([10, 20, 30, 0]));
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(3);
  });

  it("garde le meilleur record meme s'il n'est pas la serie la plus recente", () => {
    // 5 mois consecutifs (record) puis une coupure puis 2 mois (serie en cours)
    const result = computeSavingsStreak(months([10, 10, 10, 10, 10, 0, 5, 5]));
    expect(result.bestStreak).toBe(5);
    expect(result.currentStreak).toBe(2);
  });

  it("aucune activite -> aucune serie", () => {
    const result = computeSavingsStreak([]);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
  });
});
