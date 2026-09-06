import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { computeMonthlyProvision } from "../utils/provisions.js";
import type { Provision } from "@prisma/client";

export const provisionsRouter = Router();

provisionsRouter.use(requireAuth);

function serializeProvision(provision: Provision) {
  const annualAmount = Number(provision.annualAmount);
  return {
    id: provision.id,
    label: provision.label,
    annualAmount,
    monthlyAmount: computeMonthlyProvision(annualAmount),
    active: provision.active,
    createdAt: provision.createdAt,
  };
}

provisionsRouter.get("/", async (req, res) => {
  const provisions = await prisma.provision.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
  });
  const activeMonthlyTotal = provisions
    .filter((p) => p.active)
    .reduce((sum, p) => sum + computeMonthlyProvision(Number(p.annualAmount)), 0);

  res.json({ provisions: provisions.map(serializeProvision), activeMonthlyTotal });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  annualAmount: z.number().finite().positive(),
});

provisionsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const provision = await prisma.provision.create({
    data: { label: parsed.data.label, annualAmount: parsed.data.annualAmount, userId: req.userId! },
  });
  res.status(201).json({ provision: serializeProvision(provision) });
});

async function loadOwnProvision(userId: string, id: string) {
  const provision = await prisma.provision.findUnique({ where: { id } });
  if (!provision || provision.userId !== userId) return { error: 404 as const };
  return { provision };
}

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  annualAmount: z.number().finite().positive().optional(),
  active: z.boolean().optional(),
});

provisionsRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnProvision(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Provision introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const provision = await prisma.provision.update({ where: { id: result.provision.id }, data: parsed.data });
  res.json({ provision: serializeProvision(provision) });
});

provisionsRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnProvision(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Provision introuvable." });
    return;
  }
  await prisma.provision.delete({ where: { id: result.provision.id } });
  res.status(204).send();
});
