import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { BUDGET_METHODS, computeBudgetBreakdown, type BudgetMethodKey } from "../constants/budgetMethods.js";
import { buildItemTree } from "../utils/budgetItemTree.js";
import type { BudgetTemplate } from "@prisma/client";

export const budgetTemplateRouter = Router();

budgetTemplateRouter.use(requireAuth);

const METHOD_KEYS = Object.keys(BUDGET_METHODS) as [BudgetMethodKey, ...BudgetMethodKey[]];

async function serializeTemplate(template: BudgetTemplate) {
  const items = await prisma.budgetItem.findMany({ where: { templateId: template.id } });
  const tree = buildItemTree(items);

  const actualFor = (category: "BESOINS" | "ENVIES" | "EPARGNE") =>
    tree.filter((i) => i.category === category).reduce((sum, i) => sum + i.displayedAmount, 0);

  const breakdown = computeBudgetBreakdown(template.method as BudgetMethodKey, Number(template.monthlyIncome), {
    besoins: actualFor("BESOINS"),
    envies: actualFor("ENVIES"),
    epargne: actualFor("EPARGNE"),
  });

  return {
    id: template.id,
    method: template.method,
    monthlyIncome: Number(template.monthlyIncome),
    breakdown,
    items: {
      besoins: tree.filter((i) => i.category === "BESOINS"),
      envies: tree.filter((i) => i.category === "ENVIES"),
      epargne: tree.filter((i) => i.category === "EPARGNE"),
    },
  };
}

budgetTemplateRouter.get("/", async (req, res) => {
  const template = await prisma.budgetTemplate.findUnique({ where: { userId: req.userId! } });
  if (!template) {
    res.json({ template: null, methods: BUDGET_METHODS });
    return;
  }
  res.json({ template: await serializeTemplate(template), methods: BUDGET_METHODS });
});

const upsertTemplateSchema = z.object({
  method: z.enum(METHOD_KEYS),
  monthlyIncome: z.number().finite().nonnegative(),
});

budgetTemplateRouter.put("/", async (req, res) => {
  const parsed = upsertTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const template = await prisma.budgetTemplate.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, method: parsed.data.method, monthlyIncome: parsed.data.monthlyIncome },
    update: { method: parsed.data.method, monthlyIncome: parsed.data.monthlyIncome },
  });

  res.json({ template: await serializeTemplate(template) });
});

async function requireOwnTemplate(userId: string) {
  const template = await prisma.budgetTemplate.findUnique({ where: { userId } });
  if (!template) {
    return { error: "Crée d'abord ton budget type." };
  }
  return { template };
}

const createItemSchema = z.object({
  category: z.enum(["BESOINS", "ENVIES", "EPARGNE"]),
  name: z.string().trim().min(1).max(80),
  monthlyAmount: z.number().finite().nonnegative(),
  essential: z.boolean().optional(),
  parentId: z.string().min(1).optional(),
});

budgetTemplateRouter.post("/items", async (req, res) => {
  const own = await requireOwnTemplate(req.userId!);
  if ("error" in own) {
    res.status(409).json({ error: own.error });
    return;
  }

  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { category, name, monthlyAmount, essential, parentId } = parsed.data;

  if (parentId) {
    const parent = await prisma.budgetItem.findUnique({ where: { id: parentId } });
    if (!parent || parent.templateId !== own.template.id || parent.category !== category) {
      res.status(400).json({ error: "Poste parent introuvable." });
      return;
    }

    // Detailer un poste ne doit pas faire disparaitre son montant existant :
    // au premier sous-poste, on le convertit en premiere sous-depense.
    const existingChildren = await prisma.budgetItem.count({ where: { parentId: parent.id } });
    if (existingChildren === 0 && Number(parent.monthlyAmount) > 0) {
      await prisma.budgetItem.create({
        data: {
          templateId: own.template.id,
          category: parent.category,
          name: parent.name,
          monthlyAmount: parent.monthlyAmount,
          essential: parent.essential,
          parentId: parent.id,
          sortOrder: 0,
        },
      });
    }
  }

  const siblingCount = await prisma.budgetItem.count({
    where: { templateId: own.template.id, category, parentId: parentId ?? null },
  });

  const item = await prisma.budgetItem.create({
    data: {
      templateId: own.template.id,
      category,
      name,
      monthlyAmount,
      essential: essential ?? true,
      parentId: parentId ?? null,
      sortOrder: siblingCount,
    },
  });

  res.status(201).json({ template: await serializeTemplate(own.template), createdId: item.id });
});

async function loadOwnItem(userId: string, itemId: string) {
  const item = await prisma.budgetItem.findUnique({ where: { id: itemId }, include: { template: true } });
  if (!item || item.template.userId !== userId) {
    return { error: 404 as const };
  }
  return { item };
}

const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  monthlyAmount: z.number().finite().nonnegative().optional(),
  essential: z.boolean().optional(),
});

budgetTemplateRouter.patch("/items/:id", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Poste introuvable." });
    return;
  }

  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  await prisma.budgetItem.update({ where: { id: result.item.id }, data: parsed.data });
  const template = await prisma.budgetTemplate.findUniqueOrThrow({ where: { id: result.item.templateId } });
  res.json({ template: await serializeTemplate(template) });
});

budgetTemplateRouter.delete("/items/:id", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Poste introuvable." });
    return;
  }

  await prisma.budgetItem.delete({ where: { id: result.item.id } });
  const template = await prisma.budgetTemplate.findUniqueOrThrow({ where: { id: result.item.templateId } });
  res.json({ template: await serializeTemplate(template) });
});

const moveItemSchema = z.object({
  direction: z.enum(["up", "down"]),
});

budgetTemplateRouter.post("/items/:id/move", async (req, res) => {
  const result = await loadOwnItem(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Poste introuvable." });
    return;
  }
  const parsed = moveItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const { item } = result;
  const siblings = await prisma.budgetItem.findMany({
    where: { templateId: item.templateId, category: item.category, parentId: item.parentId },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((s) => s.id === item.id);
  const swapIndex = parsed.data.direction === "up" ? index - 1 : index + 1;

  if (swapIndex >= 0 && swapIndex < siblings.length) {
    const other = siblings[swapIndex];
    await prisma.$transaction([
      prisma.budgetItem.update({ where: { id: item.id }, data: { sortOrder: other.sortOrder } }),
      prisma.budgetItem.update({ where: { id: other.id }, data: { sortOrder: item.sortOrder } }),
    ]);
  }

  const template = await prisma.budgetTemplate.findUniqueOrThrow({ where: { id: item.templateId } });
  res.json({ template: await serializeTemplate(template) });
});
