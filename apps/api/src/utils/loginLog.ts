import type { Request } from "express";
import { prisma } from "../db.js";

// Journal de connexion (section 70). userId est optionnel : un email qui ne
// correspond a aucun compte est quand meme journalise (utile pour detecter
// une campagne de brute-force), mais reste invisible depuis l'historique de
// tout utilisateur puisque personne ne peut le consulter sans etre
// authentifie sous ce compte.
export async function recordLoginAttempt(params: {
  email: string;
  success: boolean;
  userId?: string;
  req: Request;
}): Promise<void> {
  await prisma.loginLog.create({
    data: {
      email: params.email,
      success: params.success,
      userId: params.userId,
      ipAddress: params.req.ip,
      userAgent: params.req.get("user-agent") ?? undefined,
    },
  });
}
