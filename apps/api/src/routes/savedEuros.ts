import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { SavedEuroEvent } from "@prisma/client";

export const savedEurosRouter = Router();

savedEurosRouter.use(requireAuth);

function serializeEvent(event: SavedEuroEvent) {
  return {
    id: event.id,
    description: event.description,
    amount: Number(event.amount),
    allocation: event.allocation,
    savingsGoalId: event.savingsGoalId,
    createdAt: event.createdAt,
  };
}

savedEurosRouter.get("/", async (req, res) => {
  const events = await prisma.savedEuroEvent.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  const total = events.reduce((sum, e) => sum + Number(e.amount), 0);
  res.json({ events: events.map(serializeEvent), total });
});

const createSchema = z.object({
  description: z.string().trim().min(1).max(120),
  amount: z.number().finite().positive(),
  allocation: z.enum(["OBJECTIF", "SECURITE", "INVESTISSEMENT", "DISPONIBLE"]),
  savingsGoalId: z.string().min(1).optional(),
});

// Une economie volontaire n'est consideree comme epargne reelle que
// lorsqu'elle est effectivement affectee (objectif/securite, qui bougent un
// vrai solde) ou au moins enregistree comme telle (investissement/garder
// disponible, qui restent tracees sans toucher a un autre total).
savedEurosRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { description, amount, allocation } = parsed.data;

  if (allocation === "OBJECTIF") {
    if (!parsed.data.savingsGoalId) {
      res.status(400).json({ error: "Choisis un objectif." });
      return;
    }
    const goal = await prisma.savingsGoal.findUnique({ where: { id: parsed.data.savingsGoalId } });
    if (!goal || goal.userId !== req.userId) {
      res.status(404).json({ error: "Objectif introuvable." });
      return;
    }
    const newAmount = Number(goal.currentAmount) + amount;
    const [, , event] = await prisma.$transaction([
      prisma.goalContribution.create({ data: { goalId: goal.id, userId: req.userId!, amount } }),
      prisma.savingsGoal.update({
        where: { id: goal.id },
        data: { currentAmount: newAmount, achieved: newAmount >= Number(goal.targetAmount) },
      }),
      prisma.savedEuroEvent.create({
        data: { description, amount, allocation, savingsGoalId: goal.id, userId: req.userId! },
      }),
    ]);
    res.status(201).json({ event: serializeEvent(event) });
    return;
  }

  if (allocation === "SECURITE") {
    const profile = await prisma.emergencyFundProfile.findUnique({ where: { userId: req.userId! } });
    if (!profile) {
      res.status(409).json({ error: "Réponds d'abord au questionnaire de vulnérabilité." });
      return;
    }
    const [, event] = await prisma.$transaction([
      prisma.emergencyFundProfile.update({
        where: { userId: req.userId! },
        data: { currentSavedAmount: Number(profile.currentSavedAmount) + amount },
      }),
      prisma.savedEuroEvent.create({
        data: { description, amount, allocation, userId: req.userId! },
      }),
    ]);
    res.status(201).json({ event: serializeEvent(event) });
    return;
  }

  const event = await prisma.savedEuroEvent.create({
    data: { description, amount, allocation, userId: req.userId! },
  });
  res.status(201).json({ event: serializeEvent(event) });
});
