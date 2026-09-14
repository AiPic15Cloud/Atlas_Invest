import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const loginLogsRouter = Router();

loginLogsRouter.use(requireAuth);

// Historique des connexions (section 70) : les 20 tentatives les plus
// recentes sur CE compte, reussies ou non, pour que l'utilisateur puisse
// repérer une connexion suspecte. N'affiche jamais les tentatives sur un
// email inconnu du systeme (userId null) — elles ne sont rattachees a
// aucun utilisateur consultable.
loginLogsRouter.get("/", async (req, res) => {
  const logs = await prisma.loginLog.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({
    logs: logs.map((log) => ({
      id: log.id,
      success: log.success,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    })),
  });
});
