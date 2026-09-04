import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { toPublicUser } from "../utils/serialize.js";

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

  const token = signAuthToken({ userId: user.id });
  res.json({ token, user: toPublicUser(user) });
});
