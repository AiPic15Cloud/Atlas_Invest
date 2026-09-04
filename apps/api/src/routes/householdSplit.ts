import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const householdSplitRouter = Router();

householdSplitRouter.use(requireAuth);

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  mode: z.enum(["EGAL", "PROPORTIONNEL"]).default("PROPORTIONNEL"),
});

// Repartition des charges communes du foyer (depenses sur les comptes
// joints) entre les membres, au prorata de leurs revenus du mois ou a
// parts egales. Le revenu total de chaque membre est toujours utilise ici
// (independamment du reglage de partage du detail des comptes bancaires),
// car un calcul de repartition equitable n'a de sens qu'avec ce chiffre.
householdSplitRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Paramètres invalides." });
    return;
  }
  const { year, month, mode } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ jointExpensesTotal: 0, members: [], mode });
    return;
  }

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

  const totalIncome = memberIncomes.reduce((sum, m) => sum + m.income, 0);

  const results = memberIncomes.map(({ member, income }) => {
    let share: number;
    if (mode === "EGAL" || totalIncome <= 0) {
      share = members.length > 0 ? 1 / members.length : 0;
    } else {
      share = income / totalIncome;
    }
    return {
      userId: member.id,
      firstName: member.firstName,
      isYou: member.id === req.userId,
      income,
      share,
      amountDue: Math.round(jointExpensesTotal * share * 100) / 100,
    };
  });

  res.json({ jointExpensesTotal, members: results, mode, fallbackToEqual: mode === "PROPORTIONNEL" && totalIncome <= 0 });
});
