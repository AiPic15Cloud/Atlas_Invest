import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { convertDecimals } from "../utils/jsonDecimal.js";

export const dataBackupRouter = Router();

dataBackupRouter.use(requireAuth);

const SCHEMA_VERSION = 1;

// Export JSON de sauvegarde (section 71 : "Le JSON doit permettre une
// vraie sauvegarde/reconstitution des données"). Scope : les données que
// CET utilisateur peut voir -- ses comptes personnels + les comptes joints
// de son foyer (mêmes règles que partout ailleurs dans l'API, voir
// listAccessibleAccounts), plus ses données propres (budget type,
// objectifs, patrimoine, prêts...). Ne contient jamais : mot de passe,
// secret 2FA, codes de secours (TwoFactorBackupCode), jeton d'accès
// personnel en clair ou haché, ni le journal de connexion (LoginLog) --
// aucun de ces éléments n'a de sens à "restaurer" et les exposer dans un
// fichier téléchargeable serait un risque de sécurité inutile.
//
// La restauration automatique (réimporter ce JSON) est volontairement hors
// scope de cette route : elle toucherait l'intégrité référentielle de
// toutes les tables ci-dessous et mérite son propre lot, avec ses propres
// garde-fous (déduplication, gestion des conflits d'ID...).
dataBackupRouter.get("/json", async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const accounts = await listAccessibleAccounts(userId);
  const accountIds = accounts.map((a) => a.id);

  const [
    household,
    incomes,
    expenses,
    expenseSplits,
    expenseAssignments,
    transfers,
    recurringCharges,
    accountEnvelopes,
    balanceCheckpoints,
    budgetTemplate,
    monthlyBudgetOverrides,
    feelingRules,
    emergencyFundProfile,
    subscriptions,
    provisions,
    anticipatedExpenses,
    loans,
    wealthSnapshots,
    wealthItems,
    correctionLogs,
    importCategoryMemory,
    decisionCosts,
    financingOffers,
    savingsGoals,
    personalAccessTokens,
    monthlyGoals,
    monthlyChallenges,
  ] = await Promise.all([
    user.householdId ? prisma.household.findUnique({ where: { id: user.householdId } }) : Promise.resolve(null),
    prisma.income.findMany({ where: { bankAccountId: { in: accountIds } } }),
    prisma.expense.findMany({ where: { bankAccountId: { in: accountIds } } }),
    prisma.expenseSplit.findMany({ where: { expense: { bankAccountId: { in: accountIds } } } }),
    prisma.expenseAssignment.findMany({ where: { expense: { bankAccountId: { in: accountIds } } } }),
    prisma.transfer.findMany({
      where: { OR: [{ fromAccountId: { in: accountIds } }, { toAccountId: { in: accountIds } }] },
    }),
    prisma.recurringCharge.findMany({ where: { bankAccountId: { in: accountIds } } }),
    prisma.accountEnvelope.findMany({ where: { bankAccountId: { in: accountIds } } }),
    prisma.balanceCheckpoint.findMany({ where: { bankAccountId: { in: accountIds } } }),
    prisma.budgetTemplate.findUnique({ where: { userId }, include: { items: true } }),
    prisma.monthlyBudgetOverride.findMany({ where: { userId } }),
    prisma.feelingRule.findMany({ where: { userId } }),
    prisma.emergencyFundProfile.findUnique({ where: { userId }, include: { envelopes: true } }),
    prisma.subscription.findMany({ where: { userId } }),
    prisma.provision.findMany({ where: { userId } }),
    prisma.anticipatedExpense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId }, include: { payments: true } }),
    prisma.wealthSnapshot.findMany({ where: { userId } }),
    prisma.wealthItem.findMany({ where: { userId }, include: { valuations: true } }),
    prisma.correctionLog.findMany({ where: { userId } }),
    prisma.importCategoryMemory.findMany({ where: { userId } }),
    prisma.decisionCost.findMany({ where: { userId }, include: { items: true } }),
    prisma.financingOffer.findMany({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId }, include: { contributions: true, savedEuroEvents: true } }),
    prisma.personalAccessToken.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        defaultPoste: true,
        defaultCategory: true,
        bankAccountId: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    }),
    user.householdId ? prisma.monthlyGoal.findMany({ where: { householdId: user.householdId } }) : Promise.resolve([]),
    user.householdId
      ? prisma.monthlyChallenge.findMany({ where: { householdId: user.householdId } })
      : Promise.resolve([]),
  ]);

  const backup = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    note:
      "Sauvegarde des données Atlas Invest (section 71). Ne contient jamais de mot de passe, de secret 2FA, de code de secours, de jeton d'accès personnel en clair, ni le journal de connexion. La restauration automatique n'est pas prise en charge : ce fichier documente vos données pour vérification ou reconstitution manuelle.",
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      createdAt: user.createdAt,
      shareDetailsWithHousehold: user.shareDetailsWithHousehold,
    },
    household,
    bankAccounts: accounts,
    incomes,
    expenses,
    expenseSplits,
    expenseAssignments,
    transfers,
    recurringCharges,
    accountEnvelopes,
    balanceCheckpoints,
    budgetTemplate,
    monthlyBudgetOverrides,
    feelingRules,
    emergencyFundProfile,
    subscriptions,
    provisions,
    anticipatedExpenses,
    loans,
    wealthSnapshots,
    wealthItems,
    correctionLogs,
    importCategoryMemory,
    decisionCosts,
    financingOffers,
    savingsGoals,
    personalAccessTokens,
    monthlyGoals,
    monthlyChallenges,
  };

  const json = JSON.stringify(convertDecimals(backup), null, 2);
  const filename = `atlas-invest-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.type("application/json").send(json);
});
