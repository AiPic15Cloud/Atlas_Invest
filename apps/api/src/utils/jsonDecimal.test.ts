import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { convertDecimals } from "./jsonDecimal.js";

describe("convertDecimals", () => {
  it("convertit un Prisma.Decimal en nombre", () => {
    const value = new Prisma.Decimal("1234.56");
    expect(convertDecimals(value)).toBe(1234.56);
  });

  it("laisse les autres valeurs inchangées", () => {
    expect(convertDecimals("Loyer")).toBe("Loyer");
    expect(convertDecimals(true)).toBe(true);
    expect(convertDecimals(null)).toBe(null);
    expect(convertDecimals(42)).toBe(42);
  });

  it("préserve les Date sans les transformer en objet vide", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(convertDecimals(date)).toBe(date);
  });

  it("convertit récursivement un objet imbriqué et un tableau", () => {
    const payload = {
      amount: new Prisma.Decimal("99.9"),
      label: "Courses",
      splits: [{ amount: new Prisma.Decimal("10"), category: "BESOINS" }],
    };
    const json = JSON.stringify(convertDecimals(payload));
    expect(JSON.parse(json)).toEqual({
      amount: 99.9,
      label: "Courses",
      splits: [{ amount: 10, category: "BESOINS" }],
    });
  });
});
