import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { simulateFinancing } from "../utils/financingSimulator.js";
import { computeEffortRate } from "../utils/effortRate.js";
import { computeRealDisposableIncome } from "../utils/realDisposableIncome.js";
import { loansFor } from "./loans.js";

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

const effortRateSchema = simulateSchema.extend({
  referenceRatePercent: z.number().finite().positive().max(100).optional(),
});

// Taux d'effort avant/apres projet (section 44) : combine le simulateur de
// financement (bac a sable) avec les donnees reelles du foyer -- revenu
// recurrent du mois courant et mensualites des prets actifs. Jamais
// presente comme un seuil automatique d'acceptation bancaire : la reference
// reste un repere configurable, pas une regle de decision (section 78).
financingSimulationsRouter.post("/effort-rate", async (req, res) => {
  const parsed = effortRateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const simulation = simulateFinancing({
    amount: parsed.data.amount,
    downPayment: parsed.data.downPayment,
    durationMonths: parsed.data.durationMonths,
    interestRatePercent: parsed.data.interestRatePercent,
    insuranceMonthly: parsed.data.insuranceMonthly,
    fees: parsed.data.fees,
  });

  const now = new Date();
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const years = [...new Set(months.map((m) => m.year))];

  const [loans, incomes, expenses] = await Promise.all([
    loansFor(req.userId!),
    prisma.income.findMany({
      where: {
        bankAccountId: { in: accountIds },
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        nature: "RECURRENT",
      },
    }),
    // REMBOURSEMENT_DETTE est explicitement exclu : ces mensualites sont
    // deja comptees via existingMonthlyDebt (Loan.monthlyPayment) et les
    // recompter ici doublerait leur poids si l'utilisateur les logue aussi
    // en depense (garde-fou section 78, "jamais compter deux fois").
    prisma.expense.findMany({
      where: { bankAccountId: { in: accountIds }, year: { in: years }, category: { not: "REMBOURSEMENT_DETTE" } },
      select: { year: true, month: true, amount: true },
    }),
  ]);

  const monthlyIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const existingMonthlyDebt = loans
    .filter((l) => !l.paidOff && Number(l.remainingBalance) > 0)
    .reduce((sum, l) => sum + Number(l.monthlyPayment), 0);

  const observedMonthlyExpenses =
    months.reduce((sum, { year, month }) => {
      const total = expenses
        .filter((e) => e.year === year && e.month === month)
        .reduce((s, e) => s + Number(e.amount), 0);
      return sum + total;
    }, 0) / months.length;

  const effortRate = computeEffortRate({
    monthlyIncome,
    existingMonthlyDebt,
    newMonthlyPayment: simulation.monthlyPaymentWithInsurance,
    referenceRatePercent: parsed.data.referenceRatePercent,
  });

  const realDisposableIncome = computeRealDisposableIncome({
    monthlyIncome,
    existingMonthlyDebt,
    newMonthlyPayment: simulation.monthlyPaymentWithInsurance,
    observedMonthlyExpenses,
  });

  res.json({
    type: parsed.data.type,
    ...simulation,
    monthlyIncome,
    existingMonthlyDebt,
    effortRate,
    realDisposableIncome,
  });
});
