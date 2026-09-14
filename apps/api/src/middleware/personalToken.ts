import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { hashPersonalAccessToken } from "../utils/personalAccessToken.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      personalAccessToken?: {
        id: string;
        userId: string;
        bankAccountId: string;
        defaultPoste: string;
        defaultCategory: string;
      };
    }
  }
}

// Authentifie une requete par jeton d'acces personnel (distinct de
// requireAuth/JWT) : reserve aux routes volontairement etroites comme la
// saisie rapide de depense (voir schema.prisma, model PersonalAccessToken).
export async function requirePersonalToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Jeton d'accès requis." });
    return;
  }

  const record = await prisma.personalAccessToken.findUnique({
    where: { tokenHash: hashPersonalAccessToken(token) },
  });

  if (!record || record.revokedAt) {
    res.status(401).json({ error: "Jeton invalide ou révoqué." });
    return;
  }

  await prisma.personalAccessToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  req.personalAccessToken = {
    id: record.id,
    userId: record.userId,
    bankAccountId: record.bankAccountId,
    defaultPoste: record.defaultPoste,
    defaultCategory: record.defaultCategory,
  };
  next();
}
