import { describe, expect, it } from "vitest";
import { findTransferCandidates } from "./transferCandidates.js";

describe("findTransferCandidates", () => {
  it("détecte une paire dépense/revenu de même montant et même mois sur des comptes différents", () => {
    const candidates = findTransferCandidates(
      [{ id: "e1", bankAccountId: "A", year: 2026, month: 9, amount: 300 }],
      [{ id: "i1", bankAccountId: "B", year: 2026, month: 9, amount: 300 }],
    );
    expect(candidates).toEqual([
      { expenseId: "e1", incomeId: "i1", fromAccountId: "A", toAccountId: "B", amount: 300, year: 2026, month: 9 },
    ]);
  });

  it("ignore une dépense et un revenu sur le même compte", () => {
    const candidates = findTransferCandidates(
      [{ id: "e1", bankAccountId: "A", year: 2026, month: 9, amount: 300 }],
      [{ id: "i1", bankAccountId: "A", year: 2026, month: 9, amount: 300 }],
    );
    expect(candidates).toEqual([]);
  });

  it("ignore des montants différents", () => {
    const candidates = findTransferCandidates(
      [{ id: "e1", bankAccountId: "A", year: 2026, month: 9, amount: 300 }],
      [{ id: "i1", bankAccountId: "B", year: 2026, month: 9, amount: 301 }],
    );
    expect(candidates).toEqual([]);
  });

  it("ignore des mois différents", () => {
    const candidates = findTransferCandidates(
      [{ id: "e1", bankAccountId: "A", year: 2026, month: 8, amount: 300 }],
      [{ id: "i1", bankAccountId: "B", year: 2026, month: 9, amount: 300 }],
    );
    expect(candidates).toEqual([]);
  });

  it("apparie 1 pour 1 sans sur-compter quand plusieurs candidats partagent le même montant", () => {
    const candidates = findTransferCandidates(
      [
        { id: "e1", bankAccountId: "A", year: 2026, month: 9, amount: 300 },
        { id: "e2", bankAccountId: "A", year: 2026, month: 9, amount: 300 },
      ],
      [{ id: "i1", bankAccountId: "B", year: 2026, month: 9, amount: 300 }],
    );
    expect(candidates).toHaveLength(1);
  });
});
