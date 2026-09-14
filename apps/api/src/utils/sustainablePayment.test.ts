import { describe, expect, it } from "vitest";
import { classifySustainableMonthlyPayment, computePurchaseCapacityRanges } from "./sustainablePayment.js";
import { simulateFinancing } from "./financingSimulator.js";

describe("classifySustainableMonthlyPayment", () => {
  it("respecte les seuils exacts de la spec (limites incluses dans la zone basse)", () => {
    expect(classifySustainableMonthlyPayment(0)).toBe("CONFORTABLE");
    expect(classifySustainableMonthlyPayment(300)).toBe("CONFORTABLE");
    expect(classifySustainableMonthlyPayment(300.01)).toBe("INTERMEDIAIRE");
    expect(classifySustainableMonthlyPayment(450)).toBe("INTERMEDIAIRE");
    expect(classifySustainableMonthlyPayment(450.01)).toBe("TENDU");
    expect(classifySustainableMonthlyPayment(550)).toBe("TENDU");
    expect(classifySustainableMonthlyPayment(550.01)).toBe("TRES_CONTRAINT");
    expect(classifySustainableMonthlyPayment(2000)).toBe("TRES_CONTRAINT");
  });
});

describe("computePurchaseCapacityRanges", () => {
  it("taux 0 %, sans assurance ni apport : capital = mensualité × durée", () => {
    const ranges = computePurchaseCapacityRanges({
      downPayment: 0,
      durationMonths: 100,
      interestRatePercent: 0,
      insuranceMonthly: 0,
    });
    expect(ranges).toEqual([
      { zone: "CONFORTABLE", minAmount: 0, maxAmount: 30000 },
      { zone: "INTERMEDIAIRE", minAmount: 30000, maxAmount: 45000 },
      { zone: "TENDU", minAmount: 45000, maxAmount: 55000 },
      { zone: "TRES_CONTRAINT", minAmount: 55000, maxAmount: null },
    ]);
  });

  it("l'assurance réduit la part crédit de la mensualité, donc la capacité", () => {
    const ranges = computePurchaseCapacityRanges({
      downPayment: 10000,
      durationMonths: 100,
      interestRatePercent: 0,
      insuranceMonthly: 50,
    });
    // Confortable : (300-50)*100 + 10000 = 35000
    expect(ranges[0]).toEqual({ zone: "CONFORTABLE", minAmount: 10000, maxAmount: 35000 });
    // Intermédiaire : (450-50)*100 + 10000 = 50000
    expect(ranges[1]).toEqual({ zone: "INTERMEDIAIRE", minAmount: 35000, maxAmount: 50000 });
  });

  it("jamais un chiffre unique : chaque zone est une fourchette min-max cohérente", () => {
    const ranges = computePurchaseCapacityRanges({
      downPayment: 0,
      durationMonths: 240,
      interestRatePercent: 3.5,
      insuranceMonthly: 40,
    });
    for (const r of ranges) {
      if (r.maxAmount !== null) expect(r.maxAmount).toBeGreaterThan(r.minAmount);
    }
    // Les zones s'enchaînent sans trou ni chevauchement.
    expect(ranges[1].minAmount).toBe(ranges[0].maxAmount);
    expect(ranges[2].minAmount).toBe(ranges[1].maxAmount);
    expect(ranges[3].minAmount).toBe(ranges[2].maxAmount);
  });

  it("cohérent avec simulateFinancing : le montant retenu reproduit bien la mensualité cible (à l'arrondi au millier près)", () => {
    const input = { downPayment: 15000, durationMonths: 240, interestRatePercent: 3.5, insuranceMonthly: 40 };
    const ranges = computePurchaseCapacityRanges(input);
    const confortableMax = ranges[0].maxAmount!;
    const result = simulateFinancing({
      amount: confortableMax,
      downPayment: input.downPayment,
      durationMonths: input.durationMonths,
      interestRatePercent: input.interestRatePercent,
      insuranceMonthly: input.insuranceMonthly,
    });
    // La mensualite totale au montant retenu doit rester proche de la
    // limite de la zone (300 €) -- l'arrondi au millier sur le capital
    // (garde-fou anti-fausse-precision) introduit quelques euros d'ecart.
    expect(Math.abs(result.monthlyPaymentWithInsurance - 300)).toBeLessThan(5);
  });

  it("taux non renseigné : reste cohérent (formule de repli, jamais une erreur)", () => {
    const ranges = computePurchaseCapacityRanges({
      downPayment: 0,
      durationMonths: 100,
      interestRatePercent: null,
      insuranceMonthly: 0,
    });
    expect(ranges[0].maxAmount).toBe(30000);
  });
});
