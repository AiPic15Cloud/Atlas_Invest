import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount, listAccessibleAccounts } from "../utils/accountAccess.js";
import { findTransferCandidates } from "../utils/transferCandidates.js";
import { monthsInRange } from "../utils/reconciliation.js";
import { shiftMonth } from "../utils/dateMath.js";
import type { Transfer } from "@prisma/client";

const CANDIDATE_WINDOW_MONTHS = 6;

export const transfersRouter = Router();

transfersRouter.use(requireAuth);

function serializeTransfer(
  transfer: Transfer & { fromAccount: { name: string }; toAccount: { name: string } },
) {
  return {
    id: transfer.id,
    amount: transfer.amount.toString(),
    date: transfer.date,
    note: transfer.note,
    fromAccountId: transfer.fromAccountId,
    fromAccountName: transfer.fromAccount.name,
    toAccountId: transfer.toAccountId,
    toAccountName: transfer.toAccount.name,
    createdAt: transfer.createdAt,
  };
}

// Un virement compte a compte n'est ni un revenu ni une depense au niveau
// du foyer (spec 4.2) : cette liste vient d'une table dediee, jamais
// d'Income/Expense, donc pas de risque de double comptage.
transfersRouter.get("/", async (req, res) => {
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const transfers = await prisma.transfer.findMany({
    where: { OR: [{ fromAccountId: { in: accountIds } }, { toAccountId: { in: accountIds } }] },
    include: { fromAccount: { select: { name: true } }, toAccount: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  res.json({ transfers: transfers.map(serializeTransfer) });
});

// Suggestions de virements mal saisis (spec section 9, garde-fou section
// 78) : une depense et un revenu de meme montant/mois sur des comptes
// differents du foyer ressemblent probablement a un virement interne.
// Detection en lecture seule, jamais de conversion automatique.
transfersRouter.get("/candidates", async (req, res) => {
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) {
    res.json({ candidates: [] });
    return;
  }

  const now = new Date();
  const start = shiftMonth(now.getFullYear(), now.getMonth() + 1, -(CANDIDATE_WINDOW_MONTHS - 1));
  const months = monthsInRange(start.year, start.month, now.getFullYear(), now.getMonth() + 1);

  const [expenses, incomes, dismissed] = await Promise.all([
    prisma.expense.findMany({
      where: { bankAccountId: { in: accountIds }, OR: months },
      select: { id: true, bankAccountId: true, year: true, month: true, amount: true },
    }),
    prisma.income.findMany({
      where: { bankAccountId: { in: accountIds }, OR: months },
      select: { id: true, bankAccountId: true, year: true, month: true, amount: true },
    }),
    prisma.correctionLog.findMany({
      where: { userId: req.userId!, type: "TRANSFER_SUGGESTION_DISMISSED" },
      select: { detail: true },
    }),
  ]);

  const dismissedPairs = new Set(dismissed.map((d) => d.detail));

  const candidates = findTransferCandidates(
    expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    incomes.map((i) => ({ ...i, amount: Number(i.amount) })),
  ).filter((c) => !dismissedPairs.has(`${c.expenseId}:${c.incomeId}`));

  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  res.json({
    candidates: candidates.map((c) => ({
      ...c,
      fromAccountName: accountNames.get(c.fromAccountId) ?? "Compte inconnu",
      toAccountName: accountNames.get(c.toAccountId) ?? "Compte inconnu",
    })),
  });
});

const candidateActionSchema = z.object({
  expenseId: z.string().min(1),
  incomeId: z.string().min(1),
});

transfersRouter.post("/candidates/convert", async (req, res) => {
  const parsed = candidateActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = new Set(accounts.map((a) => a.id));

  const [expense, income] = await Promise.all([
    prisma.expense.findUnique({ where: { id: parsed.data.expenseId } }),
    prisma.income.findUnique({ where: { id: parsed.data.incomeId } }),
  ]);
  if (!expense || !income || !accountIds.has(expense.bankAccountId) || !accountIds.has(income.bankAccountId)) {
    res.status(404).json({ error: "Dépense ou revenu introuvable." });
    return;
  }
  if (
    expense.bankAccountId === income.bankAccountId ||
    Number(expense.amount) !== Number(income.amount) ||
    expense.year !== income.year ||
    expense.month !== income.month
  ) {
    res.status(409).json({ error: "Cette paire ne correspond plus à un virement probable." });
    return;
  }

  // Date exacte inconnue (Income/Expense ne portent que l'annee et le
  // mois) : on retient le 1er du mois par convention, en le signalant
  // dans la note plutot que de presenter une date exacte non fiable.
  const approximateDate = new Date(Date.UTC(expense.year, expense.month - 1, 1));

  const [transfer] = await prisma.$transaction([
    prisma.transfer.create({
      data: {
        fromAccountId: expense.bankAccountId,
        toAccountId: income.bankAccountId,
        amount: expense.amount,
        date: approximateDate,
        note: "Converti depuis une dépense/un revenu détectés comme virement interne (date approximative).",
      },
      include: { fromAccount: { select: { name: true } }, toAccount: { select: { name: true } } },
    }),
    prisma.expense.delete({ where: { id: expense.id } }),
    prisma.income.delete({ where: { id: income.id } }),
  ]);

  res.status(201).json({ transfer: serializeTransfer(transfer) });
});

transfersRouter.post("/candidates/dismiss", async (req, res) => {
  const parsed = candidateActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  await prisma.correctionLog.create({
    data: {
      userId: req.userId!,
      type: "TRANSFER_SUGGESTION_DISMISSED",
      label: "Suggestion de virement écartée",
      detail: `${parsed.data.expenseId}:${parsed.data.incomeId}`,
    },
  });
  res.status(204).send();
});

const createTransferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().finite().positive("Le montant doit être positif."),
  date: z.string().min(1),
  note: z.string().trim().max(200).optional(),
});

transfersRouter.post("/", async (req, res) => {
  const parsed = createTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { fromAccountId, toAccountId, amount, date, note } = parsed.data;

  if (fromAccountId === toAccountId) {
    res.status(400).json({ error: "Choisis deux comptes différents." });
    return;
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    res.status(400).json({ error: "Date invalide." });
    return;
  }

  const [fromResult, toResult] = await Promise.all([
    loadAccessibleAccount(req.userId!, fromAccountId),
    loadAccessibleAccount(req.userId!, toAccountId),
  ]);
  if ("error" in fromResult || "error" in toResult) {
    res.status(404).json({ error: "Compte bancaire introuvable ou non accessible." });
    return;
  }

  const transfer = await prisma.transfer.create({
    data: { fromAccountId, toAccountId, amount, date: parsedDate, note: note || null },
    include: { fromAccount: { select: { name: true } }, toAccount: { select: { name: true } } },
  });

  res.status(201).json({ transfer: serializeTransfer(transfer) });
});

transfersRouter.delete("/:id", async (req, res) => {
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = new Set(accounts.map((a) => a.id));

  const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id } });
  if (!transfer || (!accountIds.has(transfer.fromAccountId) && !accountIds.has(transfer.toAccountId))) {
    res.status(404).json({ error: "Virement introuvable." });
    return;
  }

  await prisma.transfer.delete({ where: { id: transfer.id } });
  res.status(204).send();
});
