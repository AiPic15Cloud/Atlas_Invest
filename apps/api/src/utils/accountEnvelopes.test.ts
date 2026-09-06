import { describe, expect, it } from "vitest";
import { computeEnvelopeSummary } from "./accountEnvelopes.js";

describe("computeEnvelopeSummary", () => {
  it("calcule le libre restant quand les enveloppes tiennent dans le solde", () => {
    expect(computeEnvelopeSummary(8000, [4000, 1500, 1000])).toEqual({
      allocated: 6500,
      free: 1500,
      overAllocated: false,
    });
  });

  it("signale un dépassement sans jamais le masquer", () => {
    const result = computeEnvelopeSummary(1000, [700, 500]);
    expect(result.allocated).toBe(1200);
    expect(result.free).toBe(-200);
    expect(result.overAllocated).toBe(true);
  });

  it("aucune enveloppe : tout le solde est libre", () => {
    expect(computeEnvelopeSummary(500, [])).toEqual({ allocated: 0, free: 500, overAllocated: false });
  });
});
