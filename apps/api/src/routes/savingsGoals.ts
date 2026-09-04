import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { SavingsGoal } from "@prisma/client";

export const savingsGoalsRouter = Router();

savingsGoalsRouter.use(requireAuth);

function serializeGoal(goal: SavingsGoal) {
  const target = Number(goal.targetAmount);
  const current = Number(goal.currentAmount);
  const remaining = Math.max(target - current, 0);
  const monthlyContribution = goal.monthlyContribution !== null ? Number(goal.monthlyContribution) : null;

  let monthsRemaining: number | null = null;
  if (monthlyContribution && monthlyContribution > 0 && remaining > 0) {
    monthsRemaining = Math.ceil(remaining / monthlyContribution);
  }

  let requiredMonthlyContribution: number | null = null;
  if (goal.targetDate && remaining > 0) {
    const now = new Date();
    const monthsUntilTarget = Math.max(
      (goal.targetDate.getFullYear() - now.getFullYear()) * 12 + (goal.targetDate.getMonth() - now.getMonth()),
      1,
    );
    requiredMonthlyContribution = Math.round((remaining / monthsUntilTarget) * 100) / 100;
  }

  return {
    id: goal.id,
    name: goal.name,
    targetAmount: target,
    currentAmount: current,
    remaining,
    progressRatio: target > 0 ? Math.min(current / target, 1) : 0,
    targetDate: goal.targetDate,
    monthlyContribution,
    monthsRemaining,
    requiredMonthlyContribution,
    achieved: goal.achieved || current >= target,
    createdAt: goal.createdAt,
  };
}

savingsGoalsRouter.get("/", async (req, res) => {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
  });
  res.json({ goals: goals.map(serializeGoal) });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetAmount: z.number().finite().positive(),
  targetDate: z.string().datetime().nullable().optional(),
  monthlyContribution: z.number().finite().positive().nullable().optional(),
});

savingsGoalsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const goal = await prisma.savingsGoal.create({
    data: {
      name: parsed.data.name,
      targetAmount: parsed.data.targetAmount,
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
      monthlyContribution: parsed.data.monthlyContribution ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json({ goal: serializeGoal(goal) });
});

async function loadOwnGoal(userId: string, id: string) {
  const goal = await prisma.savingsGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) return { error: 404 as const };
  return { goal };
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  targetAmount: z.number().finite().positive().optional(),
  currentAmount: z.number().finite().min(0).optional(),
  targetDate: z.string().datetime().nullable().optional(),
  monthlyContribution: z.number().finite().positive().nullable().optional(),
});

savingsGoalsRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnGoal(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Objectif introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if ("targetDate" in parsed.data) {
    data.targetDate = parsed.data.targetDate ? new Date(parsed.data.targetDate) : null;
  }

  const targetAmount = parsed.data.targetAmount ?? Number(result.goal.targetAmount);
  const currentAmount = parsed.data.currentAmount ?? Number(result.goal.currentAmount);
  if (currentAmount >= targetAmount) data.achieved = true;

  const goal = await prisma.savingsGoal.update({ where: { id: result.goal.id }, data });
  res.json({ goal: serializeGoal(goal) });
});

const contributeSchema = z.object({ amount: z.number().finite() });

savingsGoalsRouter.post("/:id/contribute", async (req, res) => {
  const result = await loadOwnGoal(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Objectif introuvable." });
    return;
  }
  const parsed = contributeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Montant invalide." });
    return;
  }
  const newAmount = Math.max(Number(result.goal.currentAmount) + parsed.data.amount, 0);
  const goal = await prisma.savingsGoal.update({
    where: { id: result.goal.id },
    data: { currentAmount: newAmount, achieved: newAmount >= Number(result.goal.targetAmount) },
  });
  res.json({ goal: serializeGoal(goal) });
});

savingsGoalsRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnGoal(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Objectif introuvable." });
    return;
  }
  await prisma.savingsGoal.delete({ where: { id: result.goal.id } });
  res.status(204).send();
});
