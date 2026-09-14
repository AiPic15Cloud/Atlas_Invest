import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { simulateFinancing } from "../utils/financingSimulator.js";
import type { FinancingOffer } from "@prisma/client";

export const financingOffersRouter = Router();

financingOffersRouter.use(requireAuth);

// Comparaison bancaire (section 49) : chaque offre garde ses propres
// hypotheses ; les resultats (mensualite, TAEG, cout total) sont recalcules
// a la lecture par simulateFinancing plutot que stockes, pour ne jamais
// divorcer d'une formule corrigee plus tard (meme doctrine que les
// projections de prets, section 35).
function serializeOffer(offer: FinancingOffer) {
  const result = simulateFinancing({
    amount: Number(offer.amount),
    downPayment: Number(offer.downPayment),
    durationMonths: offer.durationMonths,
    interestRatePercent: offer.interestRatePercent === null ? null : Number(offer.interestRatePercent),
    insuranceMonthly: offer.insuranceMonthly === null ? undefined : Number(offer.insuranceMonthly),
    fees: offer.fees === null ? undefined : Number(offer.fees),
  });

  return {
    id: offer.id,
    label: offer.label,
    type: offer.type,
    amount: Number(offer.amount),
    downPayment: Number(offer.downPayment),
    durationMonths: offer.durationMonths,
    interestRatePercent: offer.interestRatePercent === null ? null : Number(offer.interestRatePercent),
    insuranceMonthly: offer.insuranceMonthly === null ? null : Number(offer.insuranceMonthly),
    fees: offer.fees === null ? null : Number(offer.fees),
    createdAt: offer.createdAt,
    ...result,
  };
}

financingOffersRouter.get("/", async (req, res) => {
  const offers = await prisma.financingOffer.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "asc" },
  });
  res.json({ offers: offers.map(serializeOffer) });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(["IMMOBILIER", "CONSOMMATION", "VOITURE", "TRAVAUX", "AUTRE"]),
  amount: z.number().finite().positive(),
  downPayment: z.number().finite().nonnegative().default(0),
  durationMonths: z.number().int().positive().max(600),
  interestRatePercent: z.number().finite().nonnegative().nullable(),
  insuranceMonthly: z.number().finite().nonnegative().optional(),
  fees: z.number().finite().nonnegative().optional(),
});

financingOffersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const offer = await prisma.financingOffer.create({
    data: {
      label: parsed.data.label,
      type: parsed.data.type,
      amount: parsed.data.amount,
      downPayment: parsed.data.downPayment,
      durationMonths: parsed.data.durationMonths,
      interestRatePercent: parsed.data.interestRatePercent,
      insuranceMonthly: parsed.data.insuranceMonthly ?? null,
      fees: parsed.data.fees ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json({ offer: serializeOffer(offer) });
});

financingOffersRouter.delete("/:id", async (req, res) => {
  const offer = await prisma.financingOffer.findUnique({ where: { id: req.params.id } });
  if (!offer || offer.userId !== req.userId) {
    res.status(404).json({ error: "Offre introuvable." });
    return;
  }
  await prisma.financingOffer.delete({ where: { id: offer.id } });
  res.status(204).send();
});
