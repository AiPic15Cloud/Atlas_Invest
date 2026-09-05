import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateInviteCode } from "../utils/inviteCode.js";

export const householdsRouter = Router();

householdsRouter.use(requireAuth);

const createHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

householdsRouter.post("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (user.householdId) {
    res.status(409).json({ error: "Vous appartenez déjà à un foyer." });
    return;
  }

  const parsed = createHouseholdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Le nom du foyer est requis." });
    return;
  }

  // L'occurrence d'une collision sur un code a 8 caracteres est negligeable ;
  // on retente une seule fois par securite.
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const collision = await prisma.household.findUnique({ where: { inviteCode } });
    if (!collision) break;
    inviteCode = generateInviteCode();
  }

  const household = await prisma.household.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      members: { connect: { id: user.id } },
    },
  });

  res.status(201).json({ household: { id: household.id, name: household.name, inviteCode: household.inviteCode } });
});

const joinHouseholdSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().min(1),
});

householdsRouter.post("/join", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (user.householdId) {
    res.status(409).json({ error: "Vous appartenez déjà à un foyer." });
    return;
  }

  const parsed = joinHouseholdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Code d'invitation invalide." });
    return;
  }

  const household = await prisma.household.findUnique({ where: { inviteCode: parsed.data.inviteCode } });
  if (!household) {
    res.status(404).json({ error: "Aucun foyer ne correspond à ce code d'invitation." });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { householdId: household.id } });
  res.json({ household: { id: household.id, name: household.name, inviteCode: household.inviteCode } });
});

const settingsSchema = z.object({
  currency: z.enum(["EUR", "USD", "GBP", "CHF", "CAD"]).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

householdsRouter.patch("/settings", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoins ou crée un foyer d'abord." });
    return;
  }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  const household = await prisma.household.update({ where: { id: user.householdId }, data: parsed.data });
  res.json({ currency: household.currency, fiscalYearStartMonth: household.fiscalYearStartMonth });
});

const resetSchema = z.object({ confirmName: z.string() });

// Reinitialise les donnees du foyer (depenses, revenus, budget type,
// patrimoine, prets, objectifs, abonnements, epargne de precaution...)
// sans supprimer le foyer, ses membres ni leurs comptes bancaires.
householdsRouter.post("/reset", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoins ou crée un foyer d'abord." });
    return;
  }
  const household = await prisma.household.findUniqueOrThrow({ where: { id: user.householdId } });
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.confirmName !== household.name) {
    res.status(400).json({ error: "Le nom saisi ne correspond pas au nom du foyer." });
    return;
  }

  const members = await prisma.user.findMany({ where: { householdId: household.id }, select: { id: true } });
  const memberIds = members.map((m) => m.id);
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { householdId: household.id },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  await prisma.$transaction([
    prisma.expense.deleteMany({ where: { bankAccountId: { in: bankAccountIds } } }),
    prisma.income.deleteMany({ where: { bankAccountId: { in: bankAccountIds } } }),
    prisma.recurringCharge.deleteMany({ where: { bankAccountId: { in: bankAccountIds } } }),
    prisma.subscription.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.feelingRule.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.savingsGoal.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.wealthItem.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.loan.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.correctionLog.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.importCategoryMemory.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.emergencyFundProfile.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.budgetTemplate.deleteMany({ where: { userId: { in: memberIds } } }),
    prisma.monthlyGoal.deleteMany({ where: { householdId: household.id } }),
  ]);

  res.status(204).send();
});

householdsRouter.post("/leave", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Vous n'appartenez à aucun foyer." });
    return;
  }

  const ownedAccounts = await prisma.bankAccount.count({ where: { ownerId: user.id } });
  if (ownedAccounts > 0) {
    res.status(409).json({
      error: "Supprimez ou transférez vos comptes bancaires avant de quitter le foyer.",
    });
    return;
  }

  const householdId = user.householdId;
  await prisma.user.update({ where: { id: user.id }, data: { householdId: null } });

  const remainingMembers = await prisma.user.count({ where: { householdId } });
  if (remainingMembers === 0) {
    await prisma.bankAccount.deleteMany({ where: { householdId } });
    await prisma.household.delete({ where: { id: householdId } });
  }

  res.status(204).send();
});
