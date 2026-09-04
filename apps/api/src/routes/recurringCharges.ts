import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import type { RecurringCharge } from "@prisma/client";

export const recurringChargesRouter = Router();

recurringChargesRouter.use(requireAuth);

function serializeCharge(charge: RecurringCharge, bankAccountName: string) {
  return {
    id: charge.id,
    label: charge.label,
    amount: charge.amount.toString(),
    dayOfMonth: charge.dayOfMonth,
    active: charge.active,
    bankAccountId: charge.bankAccountId,
    bankAccountName,
    createdAt: charge.createdAt,
  };
}

async function loadOwnCharge(userId: string, id: string) {
  const accounts = await listAccessibleAccounts(userId);
  const accountIds = new Set(accounts.map((a) => a.id));
  const charge = await prisma.recurringCharge.findUnique({ where: { id } });
  if (!charge || !accountIds.has(charge.bankAccountId)) return { error: 404 as const };
  return { charge };
}

recurringChargesRouter.get("/", async (req, res) => {
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

  const [charges, subscriptions] = await Promise.all([
    prisma.recurringCharge.findMany({
      where: { bankAccountId: { in: accountIds } },
      orderBy: [{ dayOfMonth: "asc" }, { createdAt: "asc" }],
    }),
    prisma.subscription.findMany({
      where: { userId: req.userId!, dismissed: false, status: { in: ["A_GARDER", "A_SURVEILLER"] } },
    }),
  ]);

  const accountsProjection = accounts.map((account) => {
    const accountCharges = charges
      .filter((c) => c.bankAccountId === account.id && c.active)
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

    let running = Number(account.initialBalance);
    let firstNegative: { dayOfMonth: number; projectedBalance: number } | null = null;
    const timeline = accountCharges.map((c) => {
      running -= Number(c.amount);
      if (firstNegative === null && running < 0) {
        firstNegative = { dayOfMonth: c.dayOfMonth, projectedBalance: running };
      }
      return { dayOfMonth: c.dayOfMonth, label: c.label, amount: Number(c.amount), projectedBalance: running };
    });

    return {
      id: account.id,
      name: account.name,
      currentBalance: Number(account.initialBalance),
      timeline,
      alert: firstNegative,
    };
  });

  res.json({
    charges: charges.map((c) => serializeCharge(c, accountNameById.get(c.bankAccountId) ?? "")),
    accounts: accountsProjection,
    subscriptionsWithoutDate: subscriptions.map((s) => ({
      id: s.id,
      poste: s.merchantLabel,
      amount: Number(s.amount),
    })),
  });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: z.number().finite().positive(),
  dayOfMonth: z.number().int().min(1).max(31),
  bankAccountId: z.string().min(1),
});

recurringChargesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const accounts = await listAccessibleAccounts(req.userId!);
  const account = accounts.find((a) => a.id === parsed.data.bankAccountId);
  if (!account) {
    res.status(404).json({ error: "Compte introuvable." });
    return;
  }

  const charge = await prisma.recurringCharge.create({
    data: {
      label: parsed.data.label,
      amount: parsed.data.amount,
      dayOfMonth: parsed.data.dayOfMonth,
      bankAccountId: account.id,
      userId: req.userId!,
    },
  });

  res.status(201).json({ charge: serializeCharge(charge, account.name) });
});

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  amount: z.number().finite().positive().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  active: z.boolean().optional(),
});

recurringChargesRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnCharge(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Échéance introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const charge = await prisma.recurringCharge.update({ where: { id: result.charge.id }, data: parsed.data });
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountName = accounts.find((a) => a.id === charge.bankAccountId)?.name ?? "";
  res.json({ charge: serializeCharge(charge, accountName) });
});

recurringChargesRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnCharge(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Échéance introuvable." });
    return;
  }
  await prisma.recurringCharge.delete({ where: { id: result.charge.id } });
  res.status(204).send();
});
