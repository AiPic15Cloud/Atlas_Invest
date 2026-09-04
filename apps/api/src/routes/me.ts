import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { toPublicUser } from "../utils/serialize.js";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });

  let household = null;
  if (user.householdId) {
    const householdRecord = await prisma.household.findUniqueOrThrow({
      where: { id: user.householdId },
      include: { members: true },
    });
    household = {
      id: householdRecord.id,
      name: householdRecord.name,
      inviteCode: householdRecord.inviteCode,
      currency: householdRecord.currency,
      fiscalYearStartMonth: householdRecord.fiscalYearStartMonth,
      members: householdRecord.members.map((member) => ({
        id: member.id,
        firstName: member.firstName,
        isYou: member.id === user.id,
        shareDetailsWithHousehold: member.shareDetailsWithHousehold,
      })),
    };
  }

  res.json({ user: toPublicUser(user), household });
});

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  shareDetailsWithHousehold: z.boolean().optional(),
});

meRouter.patch("/", async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: parsed.data,
  });

  res.json({ user: toPublicUser(user) });
});

meRouter.delete("/", async (req, res) => {
  const accountCount = await prisma.bankAccount.count({ where: { ownerId: req.userId! } });
  if (accountCount > 0) {
    res.status(409).json({
      error: "Supprimez d'abord vos comptes bancaires avant de supprimer votre compte utilisateur.",
    });
    return;
  }

  await prisma.user.delete({ where: { id: req.userId! } });
  res.status(204).send();
});
