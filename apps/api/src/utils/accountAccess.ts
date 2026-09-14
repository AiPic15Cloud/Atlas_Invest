import { prisma } from "../db.js";
import type { BankAccount } from "@prisma/client";

export type AccessibleAccountResult = { error: 404 | 403 } | { account: BankAccount };

/**
 * Un compte est modifiable par : son proprietaire (compte personnel), ou
 * n'importe quel membre du foyer (compte joint, ownerId = null).
 */
export async function loadAccessibleAccount(userId: string, accountId: string): Promise<AccessibleAccountResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });

  if (!account || !user.householdId || account.householdId !== user.householdId) {
    return { error: 404 };
  }
  if (account.ownerId !== null && account.ownerId !== userId) {
    return { error: 403 };
  }
  return { account };
}

/** Les comptes qu'un utilisateur peut voir/utiliser pour saisir des revenus ou depenses : les siens + les comptes joints de son foyer. */
export async function listAccessibleAccounts(userId: string): Promise<BankAccount[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.householdId) return [];

  return prisma.bankAccount.findMany({
    where: {
      householdId: user.householdId,
      OR: [{ ownerId: userId }, { ownerId: null }],
    },
    orderBy: { createdAt: "asc" },
  });
}

// Un compte professionnel ne doit jamais entrer automatiquement dans le
// revenu du foyer (spec section 63) : son chiffre d'affaires n'est pas une
// remuneration personnelle disponible tant qu'il n'a pas ete explicitement
// vire vers un compte personnel/joint (ce virement, lui, cree un vrai
// Income sur le compte de destination et compte normalement). Ne s'applique
// qu'aux agregats de REVENU (tableau de bord, taux d'effort, mois a
// risque...) -- pas aux depenses ni au solde, qui restent suivis
// normalement sur un compte PRO comme sur n'importe quel autre compte.
export function excludeProfessionalAccounts(accounts: BankAccount[]): BankAccount[] {
  return accounts.filter((a) => a.type !== "PRO");
}
