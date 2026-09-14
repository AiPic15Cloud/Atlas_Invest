import { describe, expect, it } from "vitest";
import { excludeProfessionalAccounts } from "./accountAccess.js";
import type { BankAccount } from "@prisma/client";

function account(id: string, type: BankAccount["type"]): BankAccount {
  return {
    id,
    name: id,
    type,
    initialBalance: "0" as unknown as BankAccount["initialBalance"],
    ownerId: null,
    householdId: "h1",
    createdAt: new Date(),
  };
}

describe("excludeProfessionalAccounts", () => {
  it("retire les comptes PRO, garde les autres types", () => {
    const accounts = [
      account("a", "COURANT"),
      account("b", "PRO"),
      account("c", "JOINT"),
      account("d", "LIVRET"),
      account("e", "AUTRE"),
    ];
    const result = excludeProfessionalAccounts(accounts).map((a) => a.id);
    expect(result).toEqual(["a", "c", "d", "e"]);
  });

  it("liste vide si tous les comptes sont PRO", () => {
    const accounts = [account("a", "PRO"), account("b", "PRO")];
    expect(excludeProfessionalAccounts(accounts)).toEqual([]);
  });

  it("ne modifie rien si aucun compte PRO", () => {
    const accounts = [account("a", "COURANT"), account("b", "JOINT")];
    expect(excludeProfessionalAccounts(accounts)).toEqual(accounts);
  });
});
