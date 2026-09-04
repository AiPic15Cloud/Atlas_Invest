import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import { normalizePosteKey } from "../constants/wastefulRules.js";

export const savingsOpportunitiesRouter = Router();

savingsOpportunitiesRouter.use(requireAuth);

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

savingsOpportunitiesRouter.get("/", async (req, res) => {
  const parsed = yearQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Année invalide." });
    return;
  }
  const { year } = parsed.data;

  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [wastefulExpenses, subscriptions] = await Promise.all([
    prisma.expense.findMany({
      where: { year, wasteful: true, bankAccountId: { in: accountIds } },
      select: { poste: true, amount: true },
    }),
    prisma.subscription.findMany({
      where: { userId: req.userId!, dismissed: false, status: "A_RESILIER" },
    }),
  ]);

  const wastefulByPoste = new Map<string, { poste: string; count: number; total: number }>();
  for (const e of wastefulExpenses) {
    const key = normalizePosteKey(e.poste);
    const entry = wastefulByPoste.get(key) ?? { poste: e.poste, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(e.amount);
    wastefulByPoste.set(key, entry);
  }
  const wastefulTotal = wastefulExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const subscriptionsToCancel = subscriptions.map((s) => ({
    id: s.id,
    poste: s.merchantLabel,
    monthlyAmount: Number(s.amount),
    annualCost: Number(s.amount) * 12,
  }));
  const subscriptionsAnnualTotal = subscriptionsToCancel.reduce((sum, s) => sum + s.annualCost, 0);

  const totalAnnual = wastefulTotal + subscriptionsAnnualTotal;

  res.json({
    year,
    wasteful: {
      total: wastefulTotal,
      byPoste: [...wastefulByPoste.values()].sort((a, b) => b.total - a.total),
    },
    subscriptionsToCancel: subscriptionsToCancel.sort((a, b) => b.annualCost - a.annualCost),
    subscriptionsAnnualTotal,
    totalAnnual,
    totalMonthlyEquivalent: totalAnnual / 12,
  });
});
