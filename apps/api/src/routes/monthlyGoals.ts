import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { MonthlyGoal } from "@prisma/client";

export const monthlyGoalsRouter = Router();

monthlyGoalsRouter.use(requireAuth);

function serializeGoal(goal: MonthlyGoal) {
  return {
    id: goal.id,
    year: goal.year,
    month: goal.month,
    label: goal.label,
    emoji: goal.emoji,
    done: goal.done,
    createdAt: goal.createdAt,
  };
}

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

monthlyGoalsRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Paramètres invalides." });
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ goals: [] });
    return;
  }
  const goals = await prisma.monthlyGoal.findMany({
    where: { householdId: user.householdId, year: parsed.data.year, month: parsed.data.month },
    orderBy: { createdAt: "asc" },
  });
  res.json({ goals: goals.map(serializeGoal) });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  emoji: z.string().trim().max(8).nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

monthlyGoalsRouter.post("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoins ou crée un foyer d'abord." });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const goal = await prisma.monthlyGoal.create({
    data: {
      label: parsed.data.label,
      emoji: parsed.data.emoji ?? null,
      year: parsed.data.year,
      month: parsed.data.month,
      householdId: user.householdId,
    },
  });
  res.status(201).json({ goal: serializeGoal(goal) });
});

async function loadOwnHouseholdGoal(userId: string, id: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const goal = await prisma.monthlyGoal.findUnique({ where: { id } });
  if (!goal || !user.householdId || goal.householdId !== user.householdId) return { error: 404 as const };
  return { goal };
}

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().trim().max(8).nullable().optional(),
  done: z.boolean().optional(),
});

monthlyGoalsRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnHouseholdGoal(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Objectif introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const goal = await prisma.monthlyGoal.update({ where: { id: result.goal.id }, data: parsed.data });
  res.json({ goal: serializeGoal(goal) });
});

monthlyGoalsRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnHouseholdGoal(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Objectif introuvable." });
    return;
  }
  await prisma.monthlyGoal.delete({ where: { id: result.goal.id } });
  res.status(204).send();
});
