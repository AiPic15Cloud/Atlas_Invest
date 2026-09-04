import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { CRITERIA, computeRecommendedMonths, computeVulnerabilityScore } from "../constants/emergencyFund.js";
import { computeEssentialMonthlyExpense } from "../utils/essentialExpense.js";
import { computeBudgetBreakdown, type BudgetMethodKey } from "../constants/budgetMethods.js";
import type { EmergencyFundProfile, SavingsEnvelope } from "@prisma/client";

export const emergencyFundRouter = Router();

emergencyFundRouter.use(requireAuth);

function serializeEnvelope(envelope: SavingsEnvelope) {
  return {
    id: envelope.id,
    name: envelope.name,
    monthlyAllocation: Number(envelope.monthlyAllocation),
  };
}

async function serializeProfile(profile: EmergencyFundProfile & { envelopes: SavingsEnvelope[] }, userId: string) {
  const answers = {
    jobStability: profile.jobStability,
    dependentsLoad: profile.dependentsLoad,
    health: profile.health,
    alternativeIncome: profile.alternativeIncome,
    debtLevel: profile.debtLevel,
  };
  const score = computeVulnerabilityScore(answers);
  const recommendedMonths = computeRecommendedMonths(score);
  const targetMonths = profile.monthsOverride ?? recommendedMonths;

  const essentialMonthlyExpense = await computeEssentialMonthlyExpense(userId);
  const targetAmount = targetMonths * essentialMonthlyExpense;

  let defaultCapacity = 0;
  const template = await prisma.budgetTemplate.findUnique({ where: { userId } });
  if (template) {
    const breakdown = computeBudgetBreakdown(template.method as BudgetMethodKey, Number(template.monthlyIncome), {
      besoins: 0,
      envies: 0,
      epargne: 0,
    });
    defaultCapacity = breakdown.capaciteEpargne;
  }
  const monthlySavingsCapacity =
    profile.monthlySavingsCapacityOverride !== null ? Number(profile.monthlySavingsCapacityOverride) : defaultCapacity;

  const currentSavedAmount = Number(profile.currentSavedAmount);
  const remainingAmount = Math.max(0, targetAmount - currentSavedAmount);
  const monthsRemaining = monthlySavingsCapacity > 0 ? remainingAmount / monthlySavingsCapacity : null;
  const progressRatio = targetAmount > 0 ? Math.min(1, currentSavedAmount / targetAmount) : 0;

  const envelopesTotal = profile.envelopes.reduce((sum, e) => sum + Number(e.monthlyAllocation), 0);

  return {
    answers,
    score,
    recommendedMonths,
    monthsOverride: profile.monthsOverride,
    targetMonths,
    essentialMonthlyExpense,
    targetAmount,
    currentSavedAmount,
    remainingAmount,
    progressRatio,
    defaultMonthlySavingsCapacity: defaultCapacity,
    monthlySavingsCapacityOverride:
      profile.monthlySavingsCapacityOverride !== null ? Number(profile.monthlySavingsCapacityOverride) : null,
    monthlySavingsCapacity,
    monthsRemaining,
    envelopes: profile.envelopes.map(serializeEnvelope),
    envelopesTotal,
    updatedAt: profile.updatedAt,
  };
}

emergencyFundRouter.get("/", async (req, res) => {
  const profile = await prisma.emergencyFundProfile.findUnique({
    where: { userId: req.userId! },
    include: { envelopes: true },
  });
  if (!profile) {
    res.json({ profile: null });
    return;
  }
  res.json({ profile: await serializeProfile(profile, req.userId!) });
});

const criteriaSchema = z.object({
  jobStability: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  dependentsLoad: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  health: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  alternativeIncome: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  debtLevel: z.union([z.literal(1), z.literal(3), z.literal(5)]),
});

emergencyFundRouter.put("/", async (req, res) => {
  const parsed = criteriaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Réponses au questionnaire invalides." });
    return;
  }

  const profile = await prisma.emergencyFundProfile.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...parsed.data },
    update: { ...parsed.data },
    include: { envelopes: true },
  });

  res.json({ profile: await serializeProfile(profile, req.userId!) });
});

const progressSchema = z.object({
  currentSavedAmount: z.number().finite().nonnegative().optional(),
  monthsOverride: z.number().int().min(1).max(36).nullable().optional(),
  monthlySavingsCapacityOverride: z.number().finite().nonnegative().nullable().optional(),
});

emergencyFundRouter.patch("/progress", async (req, res) => {
  const existing = await prisma.emergencyFundProfile.findUnique({ where: { userId: req.userId! } });
  if (!existing) {
    res.status(409).json({ error: "Réponds d'abord au questionnaire de vulnérabilité." });
    return;
  }

  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const profile = await prisma.emergencyFundProfile.update({
    where: { userId: req.userId! },
    data: parsed.data,
    include: { envelopes: true },
  });

  res.json({ profile: await serializeProfile(profile, req.userId!) });
});

const envelopeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  monthlyAllocation: z.number().finite().nonnegative(),
});

emergencyFundRouter.post("/envelopes", async (req, res) => {
  const existing = await prisma.emergencyFundProfile.findUnique({ where: { userId: req.userId! } });
  if (!existing) {
    res.status(409).json({ error: "Réponds d'abord au questionnaire de vulnérabilité." });
    return;
  }

  const parsed = envelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  await prisma.savingsEnvelope.create({ data: { profileId: existing.id, ...parsed.data } });

  const profile = await prisma.emergencyFundProfile.findUniqueOrThrow({
    where: { id: existing.id },
    include: { envelopes: true },
  });
  res.status(201).json({ profile: await serializeProfile(profile, req.userId!) });
});

async function loadOwnEnvelope(userId: string, envelopeId: string) {
  const envelope = await prisma.savingsEnvelope.findUnique({ where: { id: envelopeId }, include: { profile: true } });
  if (!envelope || envelope.profile.userId !== userId) return { error: 404 as const };
  return { envelope };
}

const updateEnvelopeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  monthlyAllocation: z.number().finite().nonnegative().optional(),
});

emergencyFundRouter.patch("/envelopes/:id", async (req, res) => {
  const result = await loadOwnEnvelope(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Enveloppe introuvable." });
    return;
  }
  const parsed = updateEnvelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  await prisma.savingsEnvelope.update({ where: { id: result.envelope.id }, data: parsed.data });
  const profile = await prisma.emergencyFundProfile.findUniqueOrThrow({
    where: { id: result.envelope.profileId },
    include: { envelopes: true },
  });
  res.json({ profile: await serializeProfile(profile, req.userId!) });
});

emergencyFundRouter.delete("/envelopes/:id", async (req, res) => {
  const result = await loadOwnEnvelope(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Enveloppe introuvable." });
    return;
  }

  await prisma.savingsEnvelope.delete({ where: { id: result.envelope.id } });
  const profile = await prisma.emergencyFundProfile.findUniqueOrThrow({
    where: { id: result.envelope.profileId },
    include: { envelopes: true },
  });
  res.json({ profile: await serializeProfile(profile, req.userId!) });
});

emergencyFundRouter.get("/criteria", (_req, res) => {
  res.json({ criteria: CRITERIA });
});
