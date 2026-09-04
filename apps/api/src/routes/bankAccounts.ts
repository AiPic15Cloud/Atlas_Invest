import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount } from "../utils/accountAccess.js";
import type { BankAccount } from "@prisma/client";

export const bankAccountsRouter = Router();

bankAccountsRouter.use(requireAuth);

function serializeAccount(account: BankAccount) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    initialBalance: account.initialBalance.toString(),
    ownerId: account.ownerId,
    createdAt: account.createdAt,
  };
}

bankAccountsRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.json({ mine: [], joint: [], household: [] });
    return;
  }

  const [mine, joint, members] = await Promise.all([
    prisma.bankAccount.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({
      where: { householdId: user.householdId, ownerId: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ where: { householdId: user.householdId, id: { not: user.id } } }),
  ]);

  const household = await Promise.all(
    members.map(async (member) => {
      const accounts = await prisma.bankAccount.findMany({
        where: { ownerId: member.id },
        orderBy: { createdAt: "asc" },
      });
      if (member.shareDetailsWithHousehold) {
        return {
          userId: member.id,
          firstName: member.firstName,
          sharesDetails: true,
          accounts: accounts.map(serializeAccount),
        };
      }
      const total = accounts.reduce((sum, account) => sum + Number(account.initialBalance), 0);
      return {
        userId: member.id,
        firstName: member.firstName,
        sharesDetails: false,
        accountCount: accounts.length,
        total,
      };
    }),
  );

  res.json({
    mine: mine.map(serializeAccount),
    joint: joint.map(serializeAccount),
    household,
  });
});

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["COURANT", "LIVRET", "PRO", "JOINT", "AUTRE"]),
  initialBalance: z.number().finite().optional(),
});

bankAccountsRouter.post("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.householdId) {
    res.status(409).json({ error: "Rejoignez ou créez un foyer avant d'ajouter un compte bancaire." });
    return;
  }

  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { name, type, initialBalance } = parsed.data;

  const account = await prisma.bankAccount.create({
    data: {
      name,
      type,
      initialBalance: initialBalance ?? 0,
      householdId: user.householdId,
      ownerId: type === "JOINT" ? null : user.id,
    },
  });

  res.status(201).json({ account: serializeAccount(account) });
});

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  initialBalance: z.number().finite().optional(),
});

bankAccountsRouter.patch("/:id", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }

  const parsed = updateAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const account = await prisma.bankAccount.update({
    where: { id: result.account.id },
    data: parsed.data,
  });

  res.json({ account: serializeAccount(account) });
});

bankAccountsRouter.delete("/:id", async (req, res) => {
  const result = await loadAccessibleAccount(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(result.error).json({ error: result.error === 404 ? "Compte introuvable." : "Accès refusé." });
    return;
  }

  await prisma.bankAccount.delete({ where: { id: result.account.id } });
  res.status(204).send();
});
