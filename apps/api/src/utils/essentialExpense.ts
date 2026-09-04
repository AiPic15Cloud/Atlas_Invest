import { prisma } from "../db.js";
import { listAccessibleAccounts } from "./accountAccess.js";
import { buildItemTree, flattenLeafItems } from "./budgetItemTree.js";
import { shiftMonth } from "./dateMath.js";

/**
 * Depense mensuelle essentielle utilisee comme base de l'objectif d'epargne
 * de precaution : en priorite la somme des postes "Besoins" essentiels du
 * budget type, sinon la moyenne des depenses "Besoins" reelles des 6
 * derniers mois avec des donnees.
 */
export async function computeEssentialMonthlyExpense(userId: string): Promise<number> {
  const template = await prisma.budgetTemplate.findUnique({ where: { userId } });
  if (template) {
    const items = await prisma.budgetItem.findMany({ where: { templateId: template.id } });
    const leaves = flattenLeafItems(buildItemTree(items));
    const sum = leaves
      .filter((leaf) => leaf.category === "BESOINS" && leaf.essential)
      .reduce((total, leaf) => total + leaf.displayedAmount, 0);
    if (sum > 0) return sum;
  }

  const accounts = await listAccessibleAccounts(userId);
  const accountIds = accounts.map((a) => a.id);
  const now = new Date();
  const windows = Array.from({ length: 6 }, (_, i) => shiftMonth(now.getFullYear(), now.getMonth() + 1, -i));

  const expenses = await prisma.expense.findMany({
    where: {
      category: "BESOINS",
      bankAccountId: { in: accountIds },
      OR: windows.map((w) => ({ year: w.year, month: w.month })),
    },
    select: { year: true, month: true, amount: true },
  });
  if (expenses.length === 0) return 0;

  const byMonth = new Map<string, number>();
  for (const e of expenses) {
    const key = `${e.year}-${e.month}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(e.amount));
  }
  const values = [...byMonth.values()];
  return values.reduce((a, b) => a + b, 0) / values.length;
}
