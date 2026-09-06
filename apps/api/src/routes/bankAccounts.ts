import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount } from "../utils/accountAccess.js";
import { computeDiscrepancy, computeExpectedBalance, isSignificantDiscrepancy, monthsInRange } from "../utils/reconciliation.js";
import { computeEnvelopeSummary } from "../utils/accountEnvelopes.js";
import type { AccountEnvelope, BankAccount, BalanceCheckpoint } from "@prisma/client";

export const bankAccountsRouter = Router();

bankAccountsRouter.use(requireAuth);

function serializeAccount(account: BankAccount) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    initialBalance: account.initialBalance.toString(),
    ownerId: account.ownerId,
    createdAt: account.createdAt,
  };
}

bankAccountsRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ mine: [], joint: [], household: [] });
    return;
  }

  const [mine, joint, members] = await Promise.all([
    prisma.bankAccount.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({
      where: { householdId: user.householdId, ownerId: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ where: { householdId: user.householdId, id: { not: user.id } } }),
  ]);

  const household = await Promise.all(
    members.map(async (member) => {
      const accounts = await prisma.bankAccount.findMany({
        where: { ownerId: member.id },
        orderBy: { createdAt: "asc" },
      });
      if (member.shareDetailsWithHousehold) {
        return {
          userId: member.id,
          firstName: member.firstName,
          sharesDetails: true,
          accounts: accounts.map(serializeAccount),
        };
      }
      const total = accounts.reduce((sum, account) => sum + Number(account.initialBalance), 0);
      return {
        userId: member.id,
        firstName: member.firstName,
        sharesDetails: false,
        accountCount: accounts.length,
        total,
      };
    }),
  );

  res.json({
    mine: mine.map(serializeAccount),
    joint: joint.map(serializeAccount),
    household,
  });
});

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["COURANT", "LIVRET", "PRO", "JOINT", "AUTRE"]),
  initialBalance: z.number().finite().optional(),
});

bankAccountsRouter.post("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoignez ou créez un foyer avant d'ajouter un compte bancaire." });
    return;
  }

  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { name, type, initialBalance } = parsed.data;

  const account = await prisma.bankAccount.create({
    data: {
      name,
      type,
      initialBalance: initialBalance ?? 0,
      householdId: user.householdId,
      ownerId: type === "JOINT" ? null : user.id,
    },
  });

  res.status(201).json({ account: serializeAccount(account) });
});

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  initialBalance: z.number().finite().optional(),
});

bankAccountsRouter.patch("/:id", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }

  const parsed = updateAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const account = await prisma.bankAccount.update({
    where: { id: result.account.id },
    data: parsed.data,
  });

  res.json({ account: serializeAccount(account) });
});

bankAccountsRouter.delete("/:id", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }

  await prisma.bankAccount.delete({ where: { id: result.account.id } });
  res.status(204).send();
});

function serializeCheckpoint(checkpoint: BalanceCheckpoint) {
  return {
    id: checkpoint.id,
    year: checkpoint.year,
    month: checkpoint.month,
    statedBalance: checkpoint.statedBalance.toString(),
    expectedBalance: checkpoint.expectedBalance?.toString() ?? null,
    discrepancy: checkpoint.discrepancy?.toString() ?? null,
    createdAt: checkpoint.createdAt,
  };
}

bankAccountsRouter.get("/:id/checkpoints", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }

  const checkpoints = await prisma.balanceCheckpoint.findMany({
    where: { bankAccountId: result.account.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  res.json({ checkpoints: checkpoints.map(serializeCheckpoint) });
});

const createCheckpointSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  statedBalance: z.number().finite(),
});

// Rapprochement bancaire (spec section 68) : l'utilisateur déclare le solde
// constaté sur son relevé pour un mois donné. Atlas recalcule le solde
// attendu depuis le dernier point de contrôle (ou depuis la création du
// compte s'il n'y en a pas encore) et affiche l'écart sans jamais le
// masquer, même s'il est nul.
bankAccountsRouter.post("/:id/checkpoints", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }
  const account = result.account;

  const parsed = createCheckpointSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { year, month, statedBalance } = parsed.data;

  const lastCheckpoint = await prisma.balanceCheckpoint.findFirst({
    where: { bankAccountId: account.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const baselineYear = lastCheckpoint ? lastCheckpoint.year : account.createdAt.getFullYear();
  const baselineMonth = lastCheckpoint ? lastCheckpoint.month : account.createdAt.getMonth() + 1;
  const previousStatedBalance = Number(lastCheckpoint ? lastCheckpoint.statedBalance : account.initialBalance);

  // Le premier point inclut le mois de création du compte (aucune donnée ne
  // peut exister avant) ; les suivants ne comptent que les mois écoulés
  // depuis le dernier point, pour ne jamais additionner deux fois la même
  // période.
  const rangeStartYear = lastCheckpoint ? (baselineMonth === 12 ? baselineYear + 1 : baselineYear) : baselineYear;
  const rangeStartMonth = lastCheckpoint ? (baselineMonth === 12 ? 1 : baselineMonth + 1) : baselineMonth;

  if (year * 12 + month < rangeStartYear * 12 + rangeStartMonth) {
    res.status(409).json({
      error: lastCheckpoint
        ? `La date doit être postérieure au dernier point de contrôle (${String(lastCheckpoint.month).padStart(2, "0")}/${lastCheckpoint.year}).`
        : "La date ne peut pas précéder la création du compte.",
    });
    return;
  }

  const months = monthsInRange(rangeStartYear, rangeStartMonth, year, month);
  const rangeStart = new Date(Date.UTC(rangeStartYear, rangeStartMonth - 1, 1));
  const rangeEndExclusive = new Date(Date.UTC(year, month, 1));

  const [incomesSum, expensesSum, transfersInSum, transfersOutSum] = await Promise.all([
    prisma.income.aggregate({
      _sum: { amount: true },
      where: { bankAccountId: account.id, OR: months },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { bankAccountId: account.id, OR: months },
    }),
    prisma.transfer.aggregate({
      _sum: { amount: true },
      where: { toAccountId: account.id, date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
    prisma.transfer.aggregate({
      _sum: { amount: true },
      where: { fromAccountId: account.id, date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
  ]);

  const expectedBalance = computeExpectedBalance({
    previousStatedBalance,
    incomesTotal: Number(incomesSum._sum.amount ?? 0),
    expensesTotal: Number(expensesSum._sum.amount ?? 0),
    transfersInTotal: Number(transfersInSum._sum.amount ?? 0),
    transfersOutTotal: Number(transfersOutSum._sum.amount ?? 0),
  });
  const discrepancy = computeDiscrepancy(statedBalance, expectedBalance);

  const [checkpoint] = await prisma.$transaction([
    prisma.balanceCheckpoint.create({
      data: {
        bankAccountId: account.id,
        year,
        month,
        statedBalance,
        expectedBalance,
        discrepancy,
      },
    }),
    prisma.bankAccount.update({
      where: { id: account.id },
      data: { initialBalance: statedBalance },
    }),
  ]);

  res.status(201).json({
    checkpoint: serializeCheckpoint(checkpoint),
    isSignificantDiscrepancy: isSignificantDiscrepancy(discrepancy),
  });
});

function serializeEnvelope(envelope: AccountEnvelope) {
  return {
    id: envelope.id,
    name: envelope.name,
    amount: envelope.amount.toString(),
    createdAt: envelope.createdAt,
  };
}

// Enveloppes virtuelles (spec section 18) : le total est toujours recalcule
// a la lecture, jamais stocke en dur, pour ne jamais desynchroniser
// l'alerte de depassement d'un solde qui a pu bouger depuis.
bankAccountsRouter.get("/:id/envelopes", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }

  const envelopes = await prisma.accountEnvelope.findMany({
    where: { bankAccountId: result.account.id },
    orderBy: { createdAt: "asc" },
  });
  const summary = computeEnvelopeSummary(
    Number(result.account.initialBalance),
    envelopes.map((e) => Number(e.amount)),
  );

  res.json({ envelopes: envelopes.map(serializeEnvelope), ...summary });
});

const createEnvelopeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  amount: z.number().finite().positive(),
});

bankAccountsRouter.post("/:id/envelopes", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }
  const parsed = createEnvelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const envelope = await prisma.accountEnvelope.create({
    data: { name: parsed.data.name, amount: parsed.data.amount, bankAccountId: result.account.id },
  });
  res.status(201).json({ envelope: serializeEnvelope(envelope) });
});

async function loadOwnEnvelope(userId: string, envelopeId: string) {
  const envelope = await prisma.accountEnvelope.findUnique({ where: { id: envelopeId } });
  if (!envelope) return { error: 404 as const };
  const account = await loadAccessibleAccount(userId, envelope.bankAccountId);
  if ("error" in account) return account;
  return { envelope };
}

const updateEnvelopeSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  amount: z.number().finite().positive().optional(),
});

bankAccountsRouter.patch("/envelopes/:envelopeId", async (req, res) => {
  const result = await loadOwnEnvelope(req.userId!, req.params.envelopeId);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Enveloppe introuvable." : "Accès refusé." });
    return;
  }
  const parsed = updateEnvelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const envelope = await prisma.accountEnvelope.update({ where: { id: result.envelope.id }, data: parsed.data });
  res.json({ envelope: serializeEnvelope(envelope) });
});

bankAccountsRouter.delete("/envelopes/:envelopeId", async (req, res) => {
  const result = await loadOwnEnvelope(req.userId!, req.params.envelopeId);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Enveloppe introuvable." : "Accès refusé." });
    return;
  }
  await prisma.accountEnvelope.delete({ where: { id: result.envelope.id } });
  res.status(204).send();
});
