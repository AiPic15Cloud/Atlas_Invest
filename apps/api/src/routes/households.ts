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
