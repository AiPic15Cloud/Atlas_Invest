import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { WEALTH_CATEGORIES, wealthItemSignedAmount, type WealthCategoryKey } from "../constants/wealth.js";
import type { WealthItem } from "@prisma/client";

export const wealthRouter = Router();

wealthRouter.use(requireAuth);

const CATEGORY_VALUES = Object.keys(WEALTH_CATEGORIES) as WealthCategoryKey[];

function serializeItem(item: WealthItem) {
  const amount = Number(item.amount);
  return {
    id: item.id,
    label: item.label,
    category: item.category,
    kind: WEALTH_CATEGORIES[item.category as WealthCategoryKey].kind,
    amount: amount.toString(),
    signedAmount: wealthItemSignedAmount(item.category as WealthCategoryKey, amount),
    createdAt: item.createdAt,
  };
}

async function bankAccountsTotal(userId: string) {
  const accounts = await prisma.bankAccount.findMany({ where: { ownerId: userId } });
  return accounts.reduce((sum, a) => sum + Number(a.initialBalance), 0);
}

async function wealthItemsFor(userId: string) {
  return prisma.wealthItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

wealthRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ mine: null, joint: { accountsTotal: 0 }, household: [], householdNetWorth: 0, categories: WEALTH_CATEGORIES });
    return;
  }

  const [myBankTotal, myItems, jointAccounts, members] = await Promise.all([
    bankAccountsTotal(user.id),
    wealthItemsFor(user.id),
    prisma.bankAccount.findMany({ where: { householdId: user.householdId, ownerId: null } }),
    prisma.user.findMany({ where: { householdId: user.householdId, id: { not: user.id } } }),
  ]);

  const jointTotal = jointAccounts.reduce((sum, a) => sum + Number(a.initialBalance), 0);
  const myItemsTotal = myItems.reduce((sum, i) => sum + wealthItemSignedAmount(i.category as WealthCategoryKey, Number(i.amount)), 0);
  const myNetWorth = myBankTotal + myItemsTotal;

  const household = await Promise.all(
    members.map(async (member) => {
      const [bankTotal, items] = await Promise.all([bankAccountsTotal(member.id), wealthItemsFor(member.id)]);
      const itemsTotal = items.reduce((sum, i) => sum + wealthItemSignedAmount(i.category as WealthCategoryKey, Number(i.amount)), 0);
      const netWorth = bankTotal + itemsTotal;
      if (member.shareDetailsWithHousehold) {
        return {
          userId: member.id,
          firstName: member.firstName,
          sharesDetails: true,
          bankAccountsTotal: bankTotal,
          wealthItems: items.map(serializeItem),
          netWorth,
        };
      }
      return {
        userId: member.id,
        firstName: member.firstName,
        sharesDetails: false,
        netWorth,
      };
    }),
  );

  const householdNetWorth = myNetWorth + jointTotal + household.reduce((sum, m) => sum + m.netWorth, 0);

  res.json({
    mine: {
      bankAccountsTotal: myBankTotal,
      wealthItems: myItems.map(serializeItem),
      wealthItemsTotal: myItemsTotal,
      netWorth: myNetWorth,
    },
    joint: { accountsTotal: jointTotal },
    household,
    householdNetWorth,
    categories: WEALTH_CATEGORIES,
  });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  category: z.enum(CATEGORY_VALUES as [WealthCategoryKey, ...WealthCategoryKey[]]),
  amount: z.number().finite().positive(),
});

wealthRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const item = await prisma.wealthItem.create({
    data: { label: parsed.data.label, category: parsed.data.category, amount: parsed.data.amount, userId: req.userId! },
  });
  res.status(201).json({ item: serializeItem(item) });
});

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  category: z.enum(CATEGORY_VALUES as [WealthCategoryKey, ...WealthCategoryKey[]]).optional(),
  amount: z.number().finite().positive().optional(),
});

async function loadOwnItem(userId: string, id: string) {
  const item = await prisma.wealthItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return { error: 404 as const };
  return { item };
}

wealthRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Élément introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const item = await prisma.wealthItem.update({ where: { id: result.item.id }, data: parsed.data });
  res.json({ item: serializeItem(item) });
});

wealthRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Élément introuvable." });
    return;
  }
  await prisma.wealthItem.delete({ where: { id: result.item.id } });
  res.status(204).send();
});
