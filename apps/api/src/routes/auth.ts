import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAuthToken, signTwoFactorPendingToken, verifyTwoFactorPendingToken } from "../utils/jwt.js";
import { toPublicUser } from "../utils/serialize.js";
import { verifyTotpCode, compareBackupCode } from "../utils/twoFactor.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  firstName: z.string().trim().min(1).max(80),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { email, password, firstName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName },
  });

  const token = signAuthToken({ userId: user.id });
  res.status(201).json({ token, user: toPublicUser(user) });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email ou mot de passe invalide." });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Email ou mot de passe incorrect." });
    return;
  }

  if (user.twoFactorEnabled) {
    const pendingToken = signTwoFactorPendingToken({ userId: user.id });
    res.json({ requiresTwoFactor: true, pendingToken });
    return;
  }

  const token = signAuthToken({ userId: user.id });
  res.json({ token, user: toPublicUser(user) });
});

const twoFactorLoginSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().trim().min(1),
});

authRouter.post("/2fa-login", async (req, res) => {
  const parsed = twoFactorLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  let userId: string;
  try {
    userId = verifyTwoFactorPendingToken(parsed.data.pendingToken).userId;
  } catch {
    res.status(401).json({ error: "Session de connexion expirée, reconnecte-toi." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    res.status(401).json({ error: "Session de connexion invalide." });
    return;
  }

  let valid = verifyTotpCode(user.twoFactorSecret, parsed.data.code);

  if (!valid) {
    const backupCodes = await prisma.twoFactorBackupCode.findMany({ where: { userId: user.id, usedAt: null } });
    for (const backup of backupCodes) {
      if (await compareBackupCode(parsed.data.code, backup.codeHash)) {
        await prisma.twoFactorBackupCode.update({ where: { id: backup.id }, data: { usedAt: new Date() } });
        valid = true;
        break;
      }
    }
  }

  if (!valid) {
    res.status(401).json({ error: "Code de vérification incorrect." });
    return;
  }

  const token = signAuthToken({ userId: user.id });
  res.json({ token, user: toPublicUser(user) });
});
