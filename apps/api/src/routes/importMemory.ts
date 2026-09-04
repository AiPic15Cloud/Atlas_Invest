import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const importMemoryRouter = Router();

importMemoryRouter.use(requireAuth);

importMemoryRouter.get("/", async (req, res) => {
  const entries = await prisma.importCategoryMemory.findMany({ where: { userId: req.userId! } });
  res.json({
    memory: Object.fromEntries(entries.map((e) => [e.merchantKey, { poste: e.poste, category: e.category }])),
  });
});

const entrySchema = z.object({
  merchantKey: z.string().trim().min(1).max(200),
  poste: z.string().trim().min(1).max(80),
  category: z.enum(["BESOINS", "ENVIES", "EPARGNE"]),
});

const bulkSchema = z.object({ entries: z.array(entrySchema).max(200) });

importMemoryRouter.post("/bulk", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }
  await Promise.all(
    parsed.data.entries.map((entry) =>
      prisma.importCategoryMemory.upsert({
        where: { userId_merchantKey: { userId: req.userId!, merchantKey: entry.merchantKey } },
        create: { userId: req.userId!, ...entry },
        update: { poste: entry.poste, category: entry.category },
      }),
    ),
  );
  res.status(204).send();
});
