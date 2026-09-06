import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { simulateFinancing } from "../utils/financingSimulator.js";

export const financingSimulationsRouter = Router();

financingSimulationsRouter.use(requireAuth);

const simulateSchema = z.object({
  type: z.enum(["IMMOBILIER", "CONSOMMATION", "VOITURE", "TRAVAUX", "AUTRE"]),
  amount: z.number().finite().positive(),
  downPayment: z.number().finite().nonnegative().default(0),
  durationMonths: z.number().int().positive().max(600),
  interestRatePercent: z.number().finite().nonnegative().nullable(),
  insuranceMonthly: z.number().finite().nonnegative().optional(),
  fees: z.number().finite().nonnegative().optional(),
});

// Bac a sable (section 37) : simulation pure, aucune donnee reelle du foyer
// n'est lue ni modifiee. Le TAEG n'est jamais annonce comme le TAEG legal
// exact (section 39) : seul un etablissement bancaire peut le certifier.
financingSimulationsRouter.post("/simulate", async (req, res) => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const result = simulateFinancing({
    amount: parsed.data.amount,
    downPayment: parsed.data.downPayment,
    durationMonths: parsed.data.durationMonths,
    interestRatePercent: parsed.data.interestRatePercent,
    insuranceMonthly: parsed.data.insuranceMonthly,
    fees: parsed.data.fees,
  });

  res.json({ type: parsed.data.type, ...result });
});
