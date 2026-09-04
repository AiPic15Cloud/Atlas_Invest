import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { normalizePosteKey } from "../constants/wastefulRules.js";
import type { Subscription } from "@prisma/client";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

const STATUS_VALUES = ["NON_EVALUE", "A_GARDER", "A_SURVEILLER", "A_RESILIER"] as const;
const USAGE_VALUES = ["QUOTIDIEN", "HEBDOMADAIRE", "MENSUEL", "RARE", "JAMAIS"] as const;

const AMOUNT_TOLERANCE_RATIO = 0.05; // +/- 5%
const AMOUNT_TOLERANCE_MIN = 1; // au moins 1 euro de marge

function monthKey(year: number, month: number) {
  return year * 12 + month;
}

/**
 * (Re)detecte les abonnements a partir des 12 derniers mois de depenses :
 * un poste qui revient sur au moins 2 mois distincts avec un montant stable
 * est un candidat abonnement. Les champs geres par l'utilisateur (statut,
 * usage, rappel) ne sont jamais ecrases par cette detection.
 */
async function refreshSubscriptions(userId: string) {
  const accounts = await listAccessibleAccounts(userId);
  const accountIds = accounts.map((a) => a.id);

  const now = new Date();
  const windowStart = monthKey(now.getFullYear(), now.getMonth() + 1) - 11;

  const expenses = await prisma.expense.findMany({
    where: { bankAccountId: { in: accountIds } },
    select: { poste: true, amount: true, year: true, month: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  const recent = expenses.filter((e) => monthKey(e.year, e.month) >= windowStart);

  const groups = new Map<
    string,
    { poste: string; months: Set<number>; amounts: number[]; first: { year: number; month: number }; last: { year: number; month: number } }
  >();

  for (const e of recent) {
    const key = normalizePosteKey(e.poste);
    let group = groups.get(key);
    if (!group) {
      group = { poste: e.poste, months: new Set(), amounts: [], first: { year: e.year, month: e.month }, last: { year: e.year, month: e.month } };
      groups.set(key, group);
    }
    group.months.add(monthKey(e.year, e.month));
    group.amounts.push(Number(e.amount));
    group.poste = e.poste;
    if (monthKey(e.year, e.month) < monthKey(group.first.year, group.first.month)) group.first = { year: e.year, month: e.month };
    if (monthKey(e.year, e.month) > monthKey(group.last.year, group.last.month)) group.last = { year: e.year, month: e.month };
  }

  const existingRules = await prisma.subscription.findMany({ where: { userId } });
  const existingByKey = new Map(existingRules.map((s) => [s.posteKey, s]));

  for (const [key, group] of groups) {
    if (group.months.size < 2) continue;
    const avg = group.amounts.reduce((a, b) => a + b, 0) / group.amounts.length;
    const tolerance = Math.max(avg * AMOUNT_TOLERANCE_RATIO, AMOUNT_TOLERANCE_MIN);
    const stable = group.amounts.every((a) => Math.abs(a - avg) <= tolerance);
    if (!stable) continue;

    const existing = existingByKey.get(key);
    if (existing?.dismissed) continue;

    const latestAmount = group.amounts[group.amounts.length - 1];

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          merchantLabel: group.poste,
          amount: latestAmount,
          lastSeenYear: group.last.year,
          lastSeenMonth: group.last.month,
          firstSeenYear: group.first.year,
          firstSeenMonth: group.first.month,
          occurrences: group.months.size,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId,
          posteKey: key,
          merchantLabel: group.poste,
          amount: latestAmount,
          firstSeenYear: group.first.year,
          firstSeenMonth: group.first.month,
          lastSeenYear: group.last.year,
          lastSeenMonth: group.last.month,
          occurrences: group.months.size,
        },
      });
    }
  }
}

function serializeSubscription(sub: Subscription) {
  const amount = Number(sub.amount);
  return {
    id: sub.id,
    poste: sub.merchantLabel,
    amount: amount.toString(),
    annualCost: amount * 12,
    status: sub.status,
    lastUsedAt: sub.lastUsedAt,
    usageFrequency: sub.usageFrequency,
    cancelReminderAt: sub.cancelReminderAt,
    firstSeen: { year: sub.firstSeenYear, month: sub.firstSeenMonth },
    lastSeen: { year: sub.lastSeenYear, month: sub.lastSeenMonth },
    occurrences: sub.occurrences,
  };
}

subscriptionsRouter.get("/", async (req, res) => {
  await refreshSubscriptions(req.userId!);
  const subs = await prisma.subscription.findMany({
    where: { userId: req.userId!, dismissed: false },
    orderBy: { amount: "desc" },
  });
  res.json({
    subscriptions: subs.map(serializeSubscription),
    annualTotal: subs.reduce((sum, s) => sum + Number(s.amount) * 12, 0),
  });
});

async function loadOwnSubscription(userId: string, id: string) {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub || sub.userId !== userId) return { error: 404 as const };
  return { sub };
}

const updateSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  lastUsedAt: z.string().datetime().nullable().optional(),
  usageFrequency: z.enum(USAGE_VALUES).nullable().optional(),
  cancelReminderAt: z.string().datetime().nullable().optional(),
});

subscriptionsRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnSubscription(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Abonnement introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.lastUsedAt) data.lastUsedAt = new Date(data.lastUsedAt as string);
  if (data.cancelReminderAt) data.cancelReminderAt = new Date(data.cancelReminderAt as string);

  const sub = await prisma.subscription.update({ where: { id: result.sub.id }, data });
  res.json({ subscription: serializeSubscription(sub) });
});

// Signale que ce n'est pas un abonnement : ne sera plus propose par la
// detection automatique.
subscriptionsRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnSubscription(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Abonnement introuvable." });
    return;
  }
  await prisma.subscription.update({ where: { id: result.sub.id }, data: { dismissed: true } });
  res.status(204).send();
});
