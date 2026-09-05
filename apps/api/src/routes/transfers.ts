import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount, listAccessibleAccounts } from "../utils/accountAccess.js";
import type { Transfer } from "@prisma/client";

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
