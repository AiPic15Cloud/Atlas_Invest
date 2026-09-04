import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const correctionHistoryRouter = Router();

correctionHistoryRouter.use(requireAuth);

correctionHistoryRouter.get("/", async (req, res) => {
  const logs = await prisma.correctionLog.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({
    logs: logs.map((log) => ({
      id: log.id,
      type: log.type,
      label: log.label,
      detail: log.detail,
      createdAt: log.createdAt,
    })),
  });
});
