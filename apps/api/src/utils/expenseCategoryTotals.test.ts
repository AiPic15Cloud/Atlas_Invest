import { describe, expect, it } from "vitest";
import { categoryAmountsFor, splitsSumMatchesExpense, sumByCategory } from "./expenseCategoryTotals.js";

const CATEGORIES = ["BESOINS", "ENVIES", "EPARGNE"] as const;

describe("categoryAmountsFor", () => {
  it("retourne la catégorie/montant de la dépense quand elle n'a pas de split", () => {
    const parts = categoryAmountsFor({ amount: 80, category: "BESOINS" });
    expect(parts).toEqual([{ category: "BESOINS", amount: 80 }]);
  });

  it("retourne les splits quand ils existent, en ignorant category/amount de la dépense", () => {
    const parts = categoryAmountsFor({
      amount: 100,
      category: "BESOINS", // ne doit plus compter, remplacé par les splits
      splits: [
        { category: "BESOINS", amount: 80 },
        { category: "ENVIES", amount: 20 },
      ],
    });
    expect(parts).toEqual([
      { category: "BESOINS", amount: 80 },
      { category: "ENVIES", amount: 20 },
    ]);
  });

  it("un tableau de splits vide est traité comme absence de split", () => {
    const parts = categoryAmountsFor({ amount: 50, category: "ENVIES", splits: [] });
    expect(parts).toEqual([{ category: "ENVIES", amount: 50 }]);
  });
});

describe("sumByCategory", () => {
  it("non-régression : sans aucun split, le total par catégorie est identique à l'ancien calcul direct", () => {
    const expenses = [
      { amount: 900, category: "BESOINS" as const },
      { amount: 350, category: "BESOINS" as const },
      { amount: 15, category: "ENVIES" as const },
      { amount: 300, category: "EPARGNE" as const },
    ];
    const totals = sumByCategory(expenses, CATEGORIES);
    expect(totals).toEqual({ BESOINS: 1250, ENVIES: 15, EPARGNE: 300 });
  });

  it("une dépense divisée compte dans chacune de ses catégories, pas dans sa catégorie d'origine", () => {
    const expenses = [
      {
        amount: 100,
        category: "BESOINS" as const,
        splits: [
          { category: "BESOINS" as const, amount: 80 },
          { category: "ENVIES" as const, amount: 20 },
        ],
      },
      { amount: 50, category: "EPARGNE" as const },
    ];
    const totals = sumByCategory(expenses, CATEGORIES);
    expect(totals).toEqual({ BESOINS: 80, ENVIES: 20, EPARGNE: 50 });
  });

  it("ignore les parts dont la catégorie n'est pas suivie (ex. INVESTISSEMENT hors barème 50/30/20)", () => {
    const expenses = [{ amount: 200, category: "INVESTISSEMENT" as const }];
    const totals = sumByCategory(expenses, CATEGORIES);
    expect(totals).toEqual({ BESOINS: 0, ENVIES: 0, EPARGNE: 0 });
  });

  it("mélange dépenses simples et divisées sans double compter ni perdre de montant", () => {
    const expenses = [
      { amount: 1600, category: "BESOINS" as const },
      {
        amount: 150,
        category: "ENVIES" as const,
        splits: [
          { category: "ENVIES" as const, amount: 100 },
          { category: "EPARGNE" as const, amount: 50 },
        ],
      },
    ];
    const totals = sumByCategory(expenses, CATEGORIES);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(grandTotal).toBe(1600 + 150); // rien perdu, rien dupliqué
    expect(totals).toEqual({ BESOINS: 1600, ENVIES: 100, EPARGNE: 50 });
  });
});

describe("splitsSumMatchesExpense", () => {
  it("accepte une somme de splits égale au montant de la dépense", () => {
    expect(splitsSumMatchesExpense(100, [{ category: "BESOINS", amount: 80 }, { category: "ENVIES", amount: 20 }])).toBe(true);
  });

  it("tolère un écart d'arrondi au centime", () => {
    expect(splitsSumMatchesExpense(100, [{ category: "BESOINS", amount: 33.33 }, { category: "ENVIES", amount: 66.67 }])).toBe(true);
  });

  it("rejette une somme de splits différente du montant", () => {
    expect(splitsSumMatchesExpense(100, [{ category: "BESOINS", amount: 80 }, { category: "ENVIES", amount: 15 }])).toBe(false);
  });
});
