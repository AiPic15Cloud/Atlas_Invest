import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { loadAccessibleAccount } from "../utils/accountAccess.js";
import { generatePersonalAccessToken, hashPersonalAccessToken } from "../utils/personalAccessToken.js";
import { CATEGORY_VALUES } from "./expenses.js";
import type { PersonalAccessToken } from "@prisma/client";

export const personalTokensRouter = Router();

personalTokensRouter.use(requireAuth);

function serializeToken(token: PersonalAccessToken & { bankAccount: { name: string } }) {
  return {
    id: token.id,
    label: token.label,
    bankAccountId: token.bankAccountId,
    bankAccountName: token.bankAccount.name,
    defaultPoste: token.defaultPoste,
    defaultCategory: token.defaultCategory,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    revokedAt: token.revokedAt,
  };
}

personalTokensRouter.get("/", async (req, res) => {
  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId: req.userId! },
    include: { bankAccount: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ tokens: tokens.map(serializeToken) });
});

const createTokenSchema = z.object({
  label: z.string().trim().min(1).max(60),
  bankAccountId: z.string().min(1),
  defaultPoste: z.string().trim().min(1).max(80),
  defaultCategory: z.enum(CATEGORY_VALUES),
});

personalTokensRouter.post("/", async (req, res) => {
  const parsed = createTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const accountResult = await loadAccessibleAccount(req.userId!, parsed.data.bankAccountId);
  if ("error" in accountResult) {
    res.status(accountResult.error).json({ error: "Compte bancaire introuvable ou non accessible." });
    return;
  }

  const rawToken = generatePersonalAccessToken();
  const token = await prisma.personalAccessToken.create({
    data: {
      label: parsed.data.label,
      bankAccountId: parsed.data.bankAccountId,
      defaultPoste: parsed.data.defaultPoste,
      defaultCategory: parsed.data.defaultCategory,
      tokenHash: hashPersonalAccessToken(rawToken),
      userId: req.userId!,
    },
    include: { bankAccount: { select: { name: true } } },
  });

  // La valeur en clair n'est jamais stockee : c'est la seule fois ou l'API
  // la renvoie.
  res.status(201).json({ token: rawToken, ...serializeToken(token) });
});

personalTokensRouter.delete("/:id", async (req, res) => {
  const token = await prisma.personalAccessToken.findUnique({ where: { id: req.params.id } });
  if (!token || token.userId !== req.userId) {
    res.status(404).json({ error: "Jeton introuvable." });
    return;
  }
  if (token.revokedAt) {
    res.status(204).send();
    return;
  }

  await prisma.personalAccessToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
  res.status(204).send();
});
