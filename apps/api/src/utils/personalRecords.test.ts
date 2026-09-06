import { describe, expect, it } from "vitest";
import { computePersonalRecords } from "./personalRecords.js";

describe("computePersonalRecords", () => {
  it("trouve le meilleur mois d'épargne, le meilleur taux, et le meilleur mois sans regret", () => {
    const result = computePersonalRecords([
      { year: 2026, month: 1, income: 3000, epargne: 300, regretTotal: 50, hasActivity: true },
      { year: 2026, month: 2, income: 3000, epargne: 812, regretTotal: 0, hasActivity: true },
      { year: 2026, month: 3, income: 2000, epargne: 480, regretTotal: 20, hasActivity: true },
    ]);
    expect(result.bestEpargneMonth).toEqual({ year: 2026, month: 2, amount: 812 });
    // fevrier : 812/3000 = 27.07%, mars : 480/2000 = 24% -> fevrier gagne aussi
    expect(result.bestSavingsRateMonth?.month).toBe(2);
    expect(result.bestRegretMonth).toEqual({ year: 2026, month: 2, amount: 0 });
  });

  it("ignore les mois sans activité", () => {
    const result = computePersonalRecords([
      { year: 2026, month: 1, income: 0, epargne: 0, regretTotal: 0, hasActivity: false },
      { year: 2026, month: 2, income: 3000, epargne: 300, regretTotal: 10, hasActivity: true },
    ]);
    expect(result.bestEpargneMonth?.month).toBe(2);
  });

  it("aucun record quand il n'y a aucune activité", () => {
    const result = computePersonalRecords([]);
    expect(result.bestEpargneMonth).toBeNull();
    expect(result.bestSavingsRateMonth).toBeNull();
    expect(result.bestRegretMonth).toBeNull();
  });

  it("un mois sans épargne du tout n'écrase pas le record d'épargne existant", () => {
    const result = computePersonalRecords([
      { year: 2026, month: 1, income: 3000, epargne: 500, regretTotal: 0, hasActivity: true },
      { year: 2026, month: 2, income: 3000, epargne: 0, regretTotal: 0, hasActivity: true },
    ]);
    expect(result.bestEpargneMonth).toEqual({ year: 2026, month: 1, amount: 500 });
  });
});
