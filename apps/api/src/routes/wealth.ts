import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { WEALTH_CATEGORIES, wealthItemSignedAmount, type WealthCategoryKey } from "../constants/wealth.js";
import { loansFor, loansRemainingTotal } from "./loans.js";
import type { AssetValuation, WealthItem } from "@prisma/client";

export const wealthRouter = Router();

wealthRouter.use(requireAuth);

const CATEGORY_VALUES = Object.keys(WEALTH_CATEGORIES) as WealthCategoryKey[];
const VALUATION_SOURCES = ["MANUELLE", "MARCHE", "ESTIMATION", "HISTORIQUE"] as const;

function serializeValuation(valuation: AssetValuation) {
  return {
    id: valuation.id,
    value: Number(valuation.value).toString(),
    valuationDate: valuation.valuationDate,
    source: valuation.source,
    note: valuation.note,
    createdAt: valuation.createdAt,
  };
}

function serializeItem(item: WealthItem & { valuations?: AssetValuation[] }) {
  const amount = Number(item.amount);
  const lastValuation = item.valuations?.[0] ?? null;
  return {
    id: item.id,
    label: item.label,
    category: item.category,
    kind: WEALTH_CATEGORIES[item.category as WealthCategoryKey].kind,
    amount: amount.toString(),
    signedAmount: wealthItemSignedAmount(item.category as WealthCategoryKey, amount),
    lastValuationSource: lastValuation?.source ?? null,
    lastValuationDate: lastValuation?.valuationDate ?? null,
    createdAt: item.createdAt,
  };
}

async function bankAccountsTotal(userId: string) {
  const accounts = await prisma.bankAccount.findMany({ where: { ownerId: userId } });
  return accounts.reduce((sum, a) => sum + Number(a.initialBalance), 0);
}

async function wealthItemsFor(userId: string) {
  return prisma.wealthItem.findMany({
    where: { userId },
    include: { valuations: { orderBy: { valuationDate: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
}

wealthRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ mine: null, joint: { accountsTotal: 0 }, household: [], householdNetWorth: 0, categories: WEALTH_CATEGORIES });
    return;
  }

  const [myBankTotal, myItems, myLoans, jointAccounts, members] = await Promise.all([
    bankAccountsTotal(user.id),
    wealthItemsFor(user.id),
    loansFor(user.id),
    prisma.bankAccount.findMany({ where: { householdId: user.householdId, ownerId: null } }),
    prisma.user.findMany({ where: { householdId: user.householdId, id: { not: user.id } } }),
  ]);

  const jointTotal = jointAccounts.reduce((sum, a) => sum + Number(a.initialBalance), 0);
  const myItemsTotal = myItems.reduce((sum, i) => sum + wealthItemSignedAmount(i.category as WealthCategoryKey, Number(i.amount)), 0);
  const myLoansTotal = loansRemainingTotal(myLoans);
  const myNetWorth = myBankTotal + myItemsTotal - myLoansTotal;

  const household = await Promise.all(
    members.map(async (member) => {
      const [bankTotal, items, loans] = await Promise.all([bankAccountsTotal(member.id), wealthItemsFor(member.id), loansFor(member.id)]);
      const itemsTotal = items.reduce((sum, i) => sum + wealthItemSignedAmount(i.category as WealthCategoryKey, Number(i.amount)), 0);
      const loansTotal = loansRemainingTotal(loans);
      const netWorth = bankTotal + itemsTotal - loansTotal;
      if (member.shareDetailsWithHousehold) {
        return {
          userId: member.id,
          firstName: member.firstName,
          sharesDetails: true,
          bankAccountsTotal: bankTotal,
          wealthItems: items.map(serializeItem),
          loansTotal,
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
      loansTotal: myLoansTotal,
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
  // La valeur saisie à la création est toujours un premier point de
  // valorisation manuelle (section 32) — jamais un simple champ sans date
  // ni provenance.
  const item = await prisma.wealthItem.create({
    data: {
      label: parsed.data.label,
      category: parsed.data.category,
      amount: parsed.data.amount,
      userId: req.userId!,
      valuations: {
        create: { value: parsed.data.amount, valuationDate: new Date(), source: "MANUELLE" },
      },
    },
    include: { valuations: { orderBy: { valuationDate: "desc" }, take: 1 } },
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

  // Un changement de valeur reste toujours trace comme une valorisation
  // manuelle (section 32), meme via ce PATCH generique.
  const writes =
    parsed.data.amount !== undefined
      ? [
          prisma.assetValuation.create({
            data: { wealthItemId: result.item.id, value: parsed.data.amount, valuationDate: new Date(), source: "MANUELLE" },
          }),
          prisma.wealthItem.update({
            where: { id: result.item.id },
            data: parsed.data,
            include: { valuations: { orderBy: { valuationDate: "desc" }, take: 1 } },
          }),
        ]
      : [
          prisma.wealthItem.update({
            where: { id: result.item.id },
            data: parsed.data,
            include: { valuations: { orderBy: { valuationDate: "desc" }, take: 1 } },
          }),
        ];

  const results = await prisma.$transaction(writes);
  const item = results[results.length - 1] as WealthItem & { valuations: AssetValuation[] };
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

wealthRouter.get("/:id/valuations", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Élément introuvable." });
    return;
  }
  const valuations = await prisma.assetValuation.findMany({
    where: { wealthItemId: result.item.id },
    orderBy: { valuationDate: "desc" },
  });
  res.json({ valuations: valuations.map(serializeValuation) });
});

const createValuationSchema = z.object({
  value: z.number().finite().positive(),
  source: z.enum(VALUATION_SOURCES),
  valuationDate: z.string().datetime().optional(),
  note: z.string().trim().max(200).optional(),
});

// Ajoute un point de valorisation (section 32) et met a jour le montant
// courant de l'actif en consequence — jamais l'inverse (le montant ne
// change jamais sans qu'un point de valorisation date/source ne l'explique).
wealthRouter.post("/:id/valuations", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Élément introuvable." });
    return;
  }
  const parsed = createValuationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const valuationDate = parsed.data.valuationDate ? new Date(parsed.data.valuationDate) : new Date();

  const [, item] = await prisma.$transaction([
    prisma.assetValuation.create({
      data: {
        wealthItemId: result.item.id,
        value: parsed.data.value,
        valuationDate,
        source: parsed.data.source,
        note: parsed.data.note || null,
      },
    }),
    prisma.wealthItem.update({
      where: { id: result.item.id },
      data: { amount: parsed.data.value },
      include: { valuations: { orderBy: { valuationDate: "desc" }, take: 1 } },
    }),
  ]);

  res.status(201).json({ item: serializeItem(item) });
});
