import { describe, expect, it } from "vitest";
import { computeMonthlyProvision, sumMonthlyProvisions } from "./provisions.js";

describe("computeMonthlyProvision", () => {
  it("mensualise une dépense annuelle (exemple de la spec : 720 € → 60 €/mois)", () => {
    expect(computeMonthlyProvision(720)).toBe(60);
  });

  it("arrondit au centime", () => {
    expect(computeMonthlyProvision(100)).toBe(8.33);
  });
});

describe("sumMonthlyProvisions", () => {
  it("additionne la mensualisation de plusieurs provisions actives", () => {
    // Assurance 720€/an + taxe foncière 1200€/an
    expect(sumMonthlyProvisions([720, 1200])).toBe(60 + 100);
  });

  it("retourne 0 sans provision", () => {
    expect(sumMonthlyProvisions([])).toBe(0);
  });
});
