import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  generateTwoFactorSecret,
  buildOtpAuthUrl,
  buildQrCodeDataUrl,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  compareBackupCode,
} from "../utils/twoFactor.js";
import { verifyPassword } from "../utils/password.js";

export const twoFactorRouter = Router();

twoFactorRouter.use(requireAuth);

twoFactorRouter.get("/status", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const remainingBackupCodes = user.twoFactorEnabled
    ? await prisma.twoFactorBackupCode.count({ where: { userId: user.id, usedAt: null } })
    : 0;
  res.json({ enabled: user.twoFactorEnabled, remainingBackupCodes });
});

// Etape 1 : genere un secret (pas encore actif) et le QR code a scanner.
twoFactorRouter.post("/setup", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (user.twoFactorEnabled) {
    res.status(409).json({ error: "La double authentification est déjà activée." });
    return;
  }

  const secret = generateTwoFactorSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

  const otpAuthUrl = buildOtpAuthUrl(user.email, secret);
  const qrCodeDataUrl = await buildQrCodeDataUrl(otpAuthUrl);

  res.json({ secret, otpAuthUrl, qrCodeDataUrl });
});

const enableSchema = z.object({ code: z.string().trim().min(1) });

// Etape 2 : confirme avec un code genere par l'appli, active la 2FA et
// renvoie les codes de secours en clair (une seule fois).
twoFactorRouter.post("/enable", async (req, res) => {
  const parsed = enableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Code invalide." });
    return;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (user.twoFactorEnabled) {
    res.status(409).json({ error: "La double authentification est déjà activée." });
    return;
  }
  if (!user.twoFactorSecret) {
    res.status(400).json({ error: "Lance d'abord la configuration." });
    return;
  }
  if (!verifyTotpCode(user.twoFactorSecret, parsed.data.code)) {
    res.status(401).json({ error: "Code incorrect." });
    return;
  }

  const backupCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorBackupCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  res.json({ backupCodes });
});

const disableSchema = z.object({ password: z.string().min(1), code: z.string().trim().min(1) });

// Desactivation : exige a la fois le mot de passe et un code valide (TOTP
// ou code de secours), pour eviter qu'une session volee suffise a couper
// la protection.
twoFactorRouter.post("/disable", async (req, res) => {
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    res.status(409).json({ error: "La double authentification n'est pas activée." });
    return;
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Mot de passe incorrect." });
    return;
  }

  let valid = verifyTotpCode(user.twoFactorSecret, parsed.data.code);
  if (!valid) {
    const backupCodes = await prisma.twoFactorBackupCode.findMany({ where: { userId: user.id, usedAt: null } });
    for (const backup of backupCodes) {
      if (await compareBackupCode(parsed.data.code, backup.codeHash)) {
        valid = true;
        break;
      }
    }
  }
  if (!valid) {
    res.status(401).json({ error: "Code incorrect." });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
  ]);

  res.status(204).send();
});
