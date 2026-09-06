import { describe, expect, it } from "vitest";
import { computeObservedMonthlyPace } from "./goalPace.js";

describe("computeObservedMonthlyPace", () => {
  it("retourne null sans aucune contribution", () => {
    expect(computeObservedMonthlyPace([])).toBeNull();
  });

  it("une seule contribution ce mois-ci = rythme égal au montant", () => {
    const now = new Date(2026, 8, 15);
    const pace = computeObservedMonthlyPace([{ amount: 200, date: new Date(2026, 8, 1) }], now);
    expect(pace).toBe(200);
  });

  it("divise le total net par le nombre de mois écoulés depuis la première contribution", () => {
    const now = new Date(2026, 8, 15);
    const pace = computeObservedMonthlyPace(
      [
        { amount: 200, date: new Date(2026, 6, 5) },
        { amount: 200, date: new Date(2026, 7, 5) },
        { amount: 200, date: new Date(2026, 8, 5) },
      ],
      now,
    );
    expect(pace).toBe(200);
  });

  it("un retrait réduit le rythme net observé", () => {
    const now = new Date(2026, 8, 15);
    const pace = computeObservedMonthlyPace(
      [
        { amount: 300, date: new Date(2026, 7, 5) },
        { amount: -100, date: new Date(2026, 8, 5) },
      ],
      now,
    );
    expect(pace).toBe(100);
  });
});
