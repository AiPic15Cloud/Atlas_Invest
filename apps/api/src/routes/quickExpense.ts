import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePersonalToken } from "../middleware/personalToken.js";
import { CATEGORY_VALUES, resolveFeeling, serializeExpense } from "./expenses.js";

export const quickExpenseRouter = Router();

quickExpenseRouter.use(requirePersonalToken);

// Saisie rapide (section 62 / raccourci iOS) : le montant est la seule
// donnee obligatoire, tout le reste vient des valeurs par defaut choisies
// a la creation du jeton (compte, poste, categorie), pour que l'appel
// depuis un Raccourci iOS reste a une seule question ("Combien ?").
const quickExpenseSchema = z.object({
  amount: z.number().finite().positive("Le montant doit être positif."),
  poste: z.string().trim().min(1).max(80).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  note: z.string().trim().max(200).optional(),
});

quickExpenseRouter.post("/", async (req, res) => {
  const parsed = quickExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }

  const pat = req.personalAccessToken!;
  const now = new Date();
  const poste = parsed.data.poste ?? pat.defaultPoste;
  const category = parsed.data.category ?? (pat.defaultCategory as (typeof CATEGORY_VALUES)[number]);
  const note = parsed.data.note ?? "Ajouté via raccourci";

  const feeling = await resolveFeeling(pat.userId, poste, parsed.data.amount, category);

  const expense = await prisma.expense.create({
    data: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      poste,
      category,
      amount: parsed.data.amount,
      note,
      bankAccountId: pat.bankAccountId,
      feeling,
    },
    include: { bankAccount: { select: { name: true } } },
  });

  res.status(201).json({ expense: serializeExpense(expense, false) });
});
