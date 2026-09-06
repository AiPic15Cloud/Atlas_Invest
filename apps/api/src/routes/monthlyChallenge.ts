import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { sumByCategory } from "../utils/expenseCategoryTotals.js";
import { computeChallengeProgress } from "../utils/monthlyChallenge.js";
import { computeControlledReward } from "../utils/controlledReward.js";
import type { MonthlyChallenge } from "@prisma/client";

export const monthlyChallengeRouter = Router();

monthlyChallengeRouter.use(requireAuth);

function serializeChallenge(challenge: MonthlyChallenge) {
  return {
    id: challenge.id,
    year: challenge.year,
    month: challenge.month,
    targetAmount: Number(challenge.targetAmount),
    stretchGoalAmount: challenge.stretchGoalAmount !== null ? Number(challenge.stretchGoalAmount) : null,
    rewardPercent: challenge.rewardPercent !== null ? Number(challenge.rewardPercent) : null,
    createdAt: challenge.createdAt,
  };
}

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// L'avancement se base uniquement sur l'epargne reellement enregistree
// (categorie EPARGNE des depenses, meme calcul que "argent construit" au
// Tableau de bord) : jamais une intention, jamais recalcule differemment
// d'un ecran a l'autre.
monthlyChallengeRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Paramètres invalides." });
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ challenge: null, saved: 0, remaining: 0, achieved: false, stretchReached: false, reward: null });
    return;
  }

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [challenge, expenses] = await Promise.all([
    prisma.monthlyChallenge.findUnique({
      where: { householdId_year_month: { householdId: user.householdId, year: parsed.data.year, month: parsed.data.month } },
    }),
    prisma.expense.findMany({
      where: { bankAccountId: { in: accountIds }, year: parsed.data.year, month: parsed.data.month },
      select: { category: true, amount: true, splits: { select: { category: true, amount: true } } },
    }),
  ]);

  const saved = sumByCategory(
    expenses.map((e) => ({
      amount: Number(e.amount),
      category: e.category,
      splits: e.splits.map((s) => ({ category: s.category, amount: Number(s.amount) })),
    })),
    ["EPARGNE"],
  ).EPARGNE;

  if (!challenge) {
    res.json({ challenge: null, saved, remaining: 0, achieved: false, stretchReached: false, reward: null });
    return;
  }

  const progress = computeChallengeProgress(
    Number(challenge.targetAmount),
    challenge.stretchGoalAmount !== null ? Number(challenge.stretchGoalAmount) : null,
    saved,
  );

  const reward =
    challenge.rewardPercent !== null
      ? computeControlledReward(Number(challenge.targetAmount), saved, Number(challenge.rewardPercent))
      : null;

  res.json({ challenge: serializeChallenge(challenge), ...progress, reward });
});

const upsertSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  targetAmount: z.number().finite().positive(),
  stretchGoalAmount: z.number().finite().positive().nullable().optional(),
  rewardPercent: z.number().finite().min(0).max(100).nullable().optional(),
});

// Un seul defi par foyer et par mois : poser un nouveau montant pour un mois
// deja defini le remplace plutot que d'en creer un second en concurrence.
monthlyChallengeRouter.post("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoins ou crée un foyer d'abord." });
    return;
  }
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  if (parsed.data.stretchGoalAmount != null && parsed.data.stretchGoalAmount <= parsed.data.targetAmount) {
    res.status(400).json({ error: "Le bonus doit être supérieur à la cible." });
    return;
  }

  const challenge = await prisma.monthlyChallenge.upsert({
    where: {
      householdId_year_month: { householdId: user.householdId, year: parsed.data.year, month: parsed.data.month },
    },
    create: {
      householdId: user.householdId,
      year: parsed.data.year,
      month: parsed.data.month,
      targetAmount: parsed.data.targetAmount,
      stretchGoalAmount: parsed.data.stretchGoalAmount ?? null,
      rewardPercent: parsed.data.rewardPercent ?? null,
    },
    update: {
      targetAmount: parsed.data.targetAmount,
      stretchGoalAmount: parsed.data.stretchGoalAmount ?? null,
      rewardPercent: parsed.data.rewardPercent ?? null,
    },
  });

  res.status(201).json({ challenge: serializeChallenge(challenge) });
});

monthlyChallengeRouter.delete("/:id", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const challenge = await prisma.monthlyChallenge.findUnique({ where: { id: req.params.id } });
  if (!challenge || !user.householdId || challenge.householdId !== user.householdId) {
    res.status(404).json({ error: "Défi introuvable." });
    return;
  }
  await prisma.monthlyChallenge.delete({ where: { id: challenge.id } });
  res.status(204).send();
});
