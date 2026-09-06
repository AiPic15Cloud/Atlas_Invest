import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { computeDecisionRealCost } from "../utils/decisionCost.js";
import type { DecisionCost, DecisionCostItem } from "@prisma/client";

export const decisionCostsRouter = Router();

decisionCostsRouter.use(requireAuth);

function serializeDecisionCost(decision: DecisionCost & { items: DecisionCostItem[] }) {
  const items = decision.items.map((i) => ({ id: i.id, label: i.label, monthlyAmount: Number(i.monthlyAmount) }));
  return {
    id: decision.id,
    label: decision.label,
    items,
    realMonthlyCost: computeDecisionRealCost(items.map((i) => ({ monthlyAmount: i.monthlyAmount }))),
    createdAt: decision.createdAt,
  };
}

decisionCostsRouter.get("/", async (req, res) => {
  const decisions = await prisma.decisionCost.findMany({
    where: { userId: req.userId! },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ decisions: decisions.map(serializeDecisionCost) });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        monthlyAmount: z.number().finite(),
      }),
    )
    .min(1)
    .max(20),
});

decisionCostsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const decision = await prisma.decisionCost.create({
    data: {
      label: parsed.data.label,
      userId: req.userId!,
      items: { create: parsed.data.items.map((i) => ({ label: i.label, monthlyAmount: i.monthlyAmount })) },
    },
    include: { items: true },
  });
  res.status(201).json({ decision: serializeDecisionCost(decision) });
});

decisionCostsRouter.delete("/:id", async (req, res) => {
  const decision = await prisma.decisionCost.findUnique({ where: { id: req.params.id } });
  if (!decision || decision.userId !== req.userId) {
    res.status(404).json({ error: "Décision introuvable." });
    return;
  }
  await prisma.decisionCost.delete({ where: { id: decision.id } });
  res.status(204).send();
});
