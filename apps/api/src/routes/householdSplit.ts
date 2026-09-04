import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const householdSplitRouter = Router();

householdSplitRouter.use(requireAuth);

export const SPLIT_MODES = [
  "PRORATA_REVENUS",
  "PARTS_EGALES",
  "RESTE_EGAL",
  "POURCENTAGE_CHOISI",
  "FORFAIT_FIXE",
] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  mode: z.enum(SPLIT_MODES).optional(),
});

type CustomShares = Record<string, number>;

function computeShares(
  mode: SplitMode,
  members: { id: string; firstName: string }[],
  incomes: Record<string, number>,
  jointExpensesTotal: number,
  customShares: CustomShares,
): { amounts: Record<string, number>; fellBackToEqual: boolean; note: string | null } {
  const n = members.length;
  const totalIncome = members.reduce((sum, m) => sum + (incomes[m.id] ?? 0), 0);

  if (n === 0) return { amounts: {}, fellBackToEqual: false, note: null };

  if (mode === "PARTS_EGALES") {
    const each = jointExpensesTotal / n;
    return { amounts: Object.fromEntries(members.map((m) => [m.id, each])), fellBackToEqual: false, note: null };
  }

  if (mode === "PRORATA_REVENUS") {
    if (totalIncome <= 0) {
      const each = jointExpensesTotal / n;
      return { amounts: Object.fromEntries(members.map((m) => [m.id, each])), fellBackToEqual: true, note: null };
    }
    return {
      amounts: Object.fromEntries(members.map((m) => [m.id, jointExpensesTotal * ((incomes[m.id] ?? 0) / totalIncome)])),
      fellBackToEqual: false,
      note: null,
    };
  }

  if (mode === "RESTE_EGAL") {
    if (totalIncome <= 0) {
      const each = jointExpensesTotal / n;
      return { amounts: Object.fromEntries(members.map((m) => [m.id, each])), fellBackToEqual: true, note: null };
    }
    const targetReste = (totalIncome - jointExpensesTotal) / n;
    const raw = Object.fromEntries(members.map((m) => [m.id, (incomes[m.id] ?? 0) - targetReste]));
    const negatives = members.filter((m) => raw[m.id] < 0);
    if (negatives.length > 0) {
      // Un membre ne peut pas couvrir sa part visee : on la ramene a 0 et on
      // reporte le manque sur les autres, au prorata de leurs revenus.
      const shortfall = negatives.reduce((sum, m) => sum - raw[m.id], 0);
      const others = members.filter((m) => raw[m.id] >= 0);
      const othersIncome = others.reduce((sum, m) => sum + (incomes[m.id] ?? 0), 0);
      negatives.forEach((m) => (raw[m.id] = 0));
      if (othersIncome > 0) {
        others.forEach((m) => (raw[m.id] += shortfall * ((incomes[m.id] ?? 0) / othersIncome)));
      }
      return {
        amounts: raw,
        fellBackToEqual: false,
        note: "Un membre ne peut pas couvrir la part visée avec ses revenus : le manque a été reporté sur les autres.",
      };
    }
    return { amounts: raw, fellBackToEqual: false, note: null };
  }

  if (mode === "POURCENTAGE_CHOISI") {
    const hasCustom = members.some((m) => typeof customShares[m.id] === "number");
    if (!hasCustom) {
      const each = jointExpensesTotal / n;
      return {
        amounts: Object.fromEntries(members.map((m) => [m.id, each])),
        fellBackToEqual: true,
        note: "Aucun pourcentage personnalisé enregistré : répartition à parts égales appliquée par défaut.",
      };
    }
    const totalPct = members.reduce((sum, m) => sum + (customShares[m.id] ?? 0), 0);
    const note = Math.abs(totalPct - 100) > 0.5 ? `Les pourcentages saisis totalisent ${Math.round(totalPct)}% (au lieu de 100%).` : null;
    return {
      amounts: Object.fromEntries(members.map((m) => [m.id, totalPct > 0 ? jointExpensesTotal * ((customShares[m.id] ?? 0) / totalPct) : 0])),
      fellBackToEqual: false,
      note,
    };
  }

  // FORFAIT_FIXE
  const hasCustom = members.some((m) => typeof customShares[m.id] === "number");
  if (!hasCustom) {
    const each = jointExpensesTotal / n;
    return {
      amounts: Object.fromEntries(members.map((m) => [m.id, each])),
      fellBackToEqual: true,
      note: "Aucun montant fixe enregistré : répartition à parts égales appliquée par défaut.",
    };
  }
  const totalFixed = members.reduce((sum, m) => sum + (customShares[m.id] ?? 0), 0);
  const diff = Math.round((jointExpensesTotal - totalFixed) * 100) / 100;
  const note =
    Math.abs(diff) > 0.01
      ? diff > 0
        ? `Les montants fixes couvrent ${Math.round((totalFixed / jointExpensesTotal) * 100)}% des charges : il manque ${diff.toFixed(2)} €.`
        : `Les montants fixes dépassent les charges de ${Math.abs(diff).toFixed(2)} €.`
      : null;
  return { amounts: Object.fromEntries(members.map((m) => [m.id, customShares[m.id] ?? 0])), fellBackToEqual: false, note };
}

householdSplitRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Paramètres invalides." });
    return;
  }
  const { year, month } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ jointExpensesTotal: 0, members: [], mode: "PRORATA_REVENUS", customShares: {} });
    return;
  }

  const household = await prisma.household.findUniqueOrThrow({ where: { id: user.householdId } });
  const mode = parsed.data.mode ?? (household.splitMode as SplitMode);
  const customShares = (household.splitCustomShares as CustomShares | null) ?? {};

  const [members, jointAccounts] = await Promise.all([
    prisma.user.findMany({ where: { householdId: user.householdId } }),
    prisma.bankAccount.findMany({ where: { householdId: user.householdId, ownerId: null } }),
  ]);

  const jointAccountIds = jointAccounts.map((a) => a.id);
  const jointExpenses = jointAccountIds.length
    ? await prisma.expense.findMany({
        where: { bankAccountId: { in: jointAccountIds }, year, month },
        select: { amount: true },
      })
    : [];
  const jointExpensesTotal = jointExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const memberIncomes = await Promise.all(
    members.map(async (member) => {
      const accounts = await prisma.bankAccount.findMany({ where: { ownerId: member.id } });
      const incomes = accounts.length
        ? await prisma.income.findMany({
            where: { bankAccountId: { in: accounts.map((a) => a.id) }, year, month },
            select: { amount: true },
          })
        : [];
      return { member, income: incomes.reduce((sum, i) => sum + Number(i.amount), 0) };
    }),
  );

  const incomesById = Object.fromEntries(memberIncomes.map(({ member, income }) => [member.id, income]));
  const totalIncome = memberIncomes.reduce((sum, m) => sum + m.income, 0);

  const { amounts, fellBackToEqual, note } = computeShares(mode, members, incomesById, jointExpensesTotal, customShares);

  const results = memberIncomes.map(({ member, income }) => {
    const amountDue = Math.round((amounts[member.id] ?? 0) * 100) / 100;
    return {
      userId: member.id,
      firstName: member.firstName,
      isYou: member.id === req.userId,
      income,
      share: jointExpensesTotal > 0 ? amountDue / jointExpensesTotal : 0,
      amountDue,
      resteAVivre: Math.round((income - amountDue) * 100) / 100,
      customValue: customShares[member.id] ?? null,
    };
  });

  res.json({
    jointExpensesTotal,
    totalIncome,
    members: results,
    mode,
    customShares,
    fallbackToEqual: fellBackToEqual,
    note,
  });
});

const settingsSchema = z.object({
  mode: z.enum(SPLIT_MODES),
  customShares: z.record(z.string(), z.number().finite().nonnegative()).optional(),
});

householdSplitRouter.patch("/settings", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoins ou crée un foyer d'abord." });
    return;
  }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const household = await prisma.household.update({
    where: { id: user.householdId },
    data: { splitMode: parsed.data.mode, splitCustomShares: parsed.data.customShares ?? {} },
  });
  res.json({ mode: household.splitMode, customShares: household.splitCustomShares });
});
