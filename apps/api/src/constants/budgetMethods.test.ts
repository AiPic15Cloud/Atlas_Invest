import { describe, expect, it } from "vitest";
import { computeBudgetBreakdown } from "./budgetMethods.js";

// Lot 1 — Correction revenus : `template.monthlyIncome` doit toujours être
// traité comme un revenu MENSUEL par computeBudgetBreakdown. Ces tests
// verrouillent ce contrat pour toutes les méthodes de répartition.
describe("computeBudgetBreakdown", () => {
  const zeroActual = { besoins: 0, envies: 0, epargne: 0 };

  it("répartition FIXED : les cibles sont des pourcentages du revenu mensuel, pas annuel", () => {
    const monthlyIncome = 3000;
    const breakdown = computeBudgetBreakdown("CONFORTABLE_50_30_20", monthlyIncome, zeroActual);
    expect(breakdown.besoinsTarget).toBe(1500); // 50 % de 3000, pas de 36000
    expect(breakdown.enviesTarget).toBe(900); // 30 %
    expect(breakdown.epargneTarget).toBe(600); // 20 %
    expect(breakdown.besoinsTarget + breakdown.enviesTarget + breakdown.epargneTarget).toBeCloseTo(monthlyIncome, 6);
  });

  it("répartition CASCADE : les envies récupèrent le reste du revenu mensuel", () => {
    const monthlyIncome = 2000;
    const breakdown = computeBudgetBreakdown("CASCADES_3", monthlyIncome, zeroActual);
    expect(breakdown.besoinsTarget).toBe(1000); // 50 %
    expect(breakdown.epargneTarget).toBe(400); // 20 %
    expect(breakdown.enviesTarget).toBe(600); // le reste, pas 30 % recalculé sur l'annuel
  });

  it("répartition BASE_ZERO : les cibles suivent le réel saisi, indépendamment du revenu", () => {
    const breakdown = computeBudgetBreakdown("BASE_ZERO", 3000, { besoins: 1200, envies: 300, epargne: 500 });
    expect(breakdown.besoinsTarget).toBe(1200);
    expect(breakdown.enviesTarget).toBe(300);
    expect(breakdown.epargneTarget).toBe(500);
  });

  it("le reste à vivre et la capacité d'épargne restent à l'échelle mensuelle", () => {
    const monthlyIncome = 3200;
    const breakdown = computeBudgetBreakdown("TENDUE_60_25_15", monthlyIncome, zeroActual);
    expect(breakdown.resteAVivre).toBe(monthlyIncome - breakdown.besoinsTarget);
    expect(breakdown.capaciteEpargne).toBe(breakdown.epargneTarget);
    // Garde-fou explicite : un résultat à l'échelle annuelle (x12) serait une régression.
    expect(breakdown.resteAVivre).toBeLessThan(monthlyIncome * 12);
  });
});
