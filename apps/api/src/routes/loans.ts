import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { applyLoanPayment, loanPaymentSplitIsValid } from "../utils/loanPayment.js";
import { computeDebtCockpit, projectLoan } from "../utils/debtCockpit.js";
import { simulateEarlyRepayment } from "../utils/earlyRepayment.js";
import { listAccessibleAccounts } from "../utils/accountAccess.js";
import type { Loan, LoanPayment } from "@prisma/client";

export const loansRouter = Router();

loansRouter.use(requireAuth);

function serializeLoan(loan: Loan) {
  const principal = Number(loan.principalAmount);
  const remaining = Number(loan.remainingBalance);
  const monthlyPayment = Number(loan.monthlyPayment);
  const interestRate = loan.interestRate !== null ? Number(loan.interestRate) : null;

  const paidOff = loan.paidOff || remaining <= 0;

  // Projection coherente avec le cockpit dette (section 35) : quand le taux
  // est connu, la duree restante et les interets restants en tiennent compte
  // plutot qu'une simple division qui ignorerait les interets a venir.
  const projection = paidOff
    ? null
    : projectLoan(
        {
          id: loan.id,
          label: loan.label,
          principalAmount: principal,
          remainingBalance: remaining,
          monthlyPayment,
          interestRate,
          endDate: loan.endDate,
        },
        new Date(),
      );
  const monthsRemaining = projection?.monthsRemaining ?? null;
  const projectedPayoffDate = projection?.endDate ?? null;

  return {
    id: loan.id,
    label: loan.label,
    principalAmount: principal,
    remainingBalance: paidOff ? 0 : remaining,
    monthlyPayment,
    interestRate,
    startDate: loan.startDate,
    endDate: loan.endDate,
    progressRatio: principal > 0 ? Math.min(Math.max((principal - remaining) / principal, 0), 1) : 0,
    monthsRemaining,
    projectedPayoffDate,
    paidOff,
    archivedAt: loan.archivedAt,
    createdAt: loan.createdAt,
  };
}

// N'inclut jamais les prets archives (section 66) : ils ne comptent plus
// dans le patrimoine net ni dans la liste par defaut, mais restent en base
// avec leur historique LoanPayment, consultables via GET /archived.
export async function loansFor(userId: string) {
  return prisma.loan.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" } });
}

export function loansRemainingTotal(loans: Loan[]) {
  return loans.reduce((sum, l) => sum + (l.paidOff ? 0 : Number(l.remainingBalance)), 0);
}

loansRouter.get("/", async (req, res) => {
  const loans = await loansFor(req.userId!);
  res.json({ loans: loans.map(serializeLoan) });
});

// Cockpit dette (section 35) : synthese sur tous les prets actifs, jamais une
// fausse precision sur les interets restants quand un taux manque.
loansRouter.get("/cockpit", async (req, res) => {
  const now = new Date();
  const accounts = await listAccessibleAccounts(req.userId!);
  const accountIds = accounts.map((a) => a.id);

  const [loans, incomes] = await Promise.all([
    loansFor(req.userId!),
    prisma.income.findMany({
      where: {
        bankAccountId: { in: accountIds },
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        nature: "RECURRENT",
      },
    }),
  ]);

  const activeLoans = loans.filter((l) => !l.paidOff && Number(l.remainingBalance) > 0);
  const monthlyRecurringIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

  const cockpit = computeDebtCockpit(
    activeLoans.map((l) => ({
      id: l.id,
      label: l.label,
      principalAmount: Number(l.principalAmount),
      remainingBalance: Number(l.remainingBalance),
      monthlyPayment: Number(l.monthlyPayment),
      interestRate: l.interestRate !== null ? Number(l.interestRate) : null,
      endDate: l.endDate,
    })),
    now,
    monthlyRecurringIncome,
  );

  res.json(cockpit);
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  principalAmount: z.number().finite().positive(),
  remainingBalance: z.number().finite().min(0).optional(),
  monthlyPayment: z.number().finite().positive(),
  interestRate: z.number().finite().min(0).max(100).nullable().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable().optional(),
});

loansRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const remainingBalance = parsed.data.remainingBalance ?? parsed.data.principalAmount;
  const loan = await prisma.loan.create({
    data: {
      label: parsed.data.label,
      principalAmount: parsed.data.principalAmount,
      remainingBalance,
      monthlyPayment: parsed.data.monthlyPayment,
      interestRate: parsed.data.interestRate ?? null,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      paidOff: remainingBalance <= 0,
      userId: req.userId!,
    },
  });
  res.status(201).json({ loan: serializeLoan(loan) });
});

async function loadOwnLoan(userId: string, id: string) {
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan || loan.userId !== userId) return { error: 404 as const };
  return { loan };
}

const simulateEarlyRepaymentSchema = z.object({
  extraPayment: z.number().finite().positive(),
});

// Simulation "Et si je rembourse X € maintenant ?" (section 36) : lecture
// seule, ne modifie jamais le pret ni l'epargne de precaution.
loansRouter.post("/:id/simulate-early-repayment", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  const parsed = simulateEarlyRepaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Montant invalide." });
    return;
  }

  const simulation = simulateEarlyRepayment(
    {
      id: result.loan.id,
      label: result.loan.label,
      principalAmount: Number(result.loan.principalAmount),
      remainingBalance: Number(result.loan.remainingBalance),
      monthlyPayment: Number(result.loan.monthlyPayment),
      interestRate: result.loan.interestRate !== null ? Number(result.loan.interestRate) : null,
      endDate: result.loan.endDate,
    },
    parsed.data.extraPayment,
    new Date(),
  );

  const emergencyFund = await prisma.emergencyFundProfile.findUnique({ where: { userId: req.userId! } });
  const emergencyFundImpact = emergencyFund
    ? {
        currentSavedAmount: Number(emergencyFund.currentSavedAmount),
        remainingAfter: Math.round((Number(emergencyFund.currentSavedAmount) - parsed.data.extraPayment) * 100) / 100,
      }
    : null;

  res.json({ ...simulation, emergencyFundImpact });
});

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  principalAmount: z.number().finite().positive().optional(),
  remainingBalance: z.number().finite().min(0).optional(),
  monthlyPayment: z.number().finite().positive().optional(),
  interestRate: z.number().finite().min(0).max(100).nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

loansRouter.patch("/:id", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if ("startDate" in parsed.data && parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  if ("endDate" in parsed.data) data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;

  const remainingBalance = parsed.data.remainingBalance ?? Number(result.loan.remainingBalance);
  if ("remainingBalance" in parsed.data) data.paidOff = remainingBalance <= 0;

  // Les conditions d'un pret (capital, mensualite, taux, capital restant
  // saisi a la main) sont des modifications importantes a historiser
  // (section 66, exemple explicite : "pret modifie").
  const trackedFields: { key: keyof typeof parsed.data; label: string; suffix: string }[] = [
    { key: "principalAmount", label: "capital initial", suffix: " €" },
    { key: "remainingBalance", label: "capital restant dû", suffix: " €" },
    { key: "monthlyPayment", label: "mensualité", suffix: " €" },
    { key: "interestRate", label: "taux", suffix: " %" },
  ];
  const formatPrevious = (value: unknown) => (value === null ? "non renseigné" : `${Number(value)}`);
  const changes = trackedFields
    .filter((f) => {
      const previous = result.loan[f.key as keyof typeof result.loan];
      const previousNumber = previous === null ? null : Number(previous);
      return parsed.data[f.key] !== undefined && parsed.data[f.key] !== previousNumber;
    })
    .map((f) => {
      const previous = result.loan[f.key as keyof typeof result.loan];
      return `${f.label} : ${formatPrevious(previous)}${previous === null ? "" : f.suffix} → ${parsed.data[f.key]}${f.suffix}`;
    });

  if (changes.length > 0) {
    await prisma.correctionLog.create({
      data: {
        userId: req.userId!,
        type: "LOAN_MODIFIED",
        label: `Prêt "${result.loan.label}" modifié`,
        detail: changes.join(" ; "),
      },
    });
  }

  const loan = await prisma.loan.update({ where: { id: result.loan.id }, data });
  res.json({ loan: serializeLoan(loan) });
});

function serializeLoanPayment(payment: LoanPayment) {
  return {
    id: payment.id,
    date: payment.date,
    totalAmount: Number(payment.totalAmount),
    principalAmount: Number(payment.principalAmount),
    interestAmount: Number(payment.interestAmount),
    insuranceAmount: Number(payment.insuranceAmount),
    createdAt: payment.createdAt,
  };
}

loansRouter.get("/:id/payments", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  const payments = await prisma.loanPayment.findMany({
    where: { loanId: result.loan.id },
    orderBy: { date: "desc" },
  });
  res.json({ payments: payments.map(serializeLoanPayment) });
});

const recordPaymentSchema = z.object({
  date: z.string().datetime().optional(),
  totalAmount: z.number().finite().positive(),
  interestAmount: z.number().finite().min(0).default(0),
  insuranceAmount: z.number().finite().min(0).default(0),
});

// Enregistre une mensualite en ventilant capital / interets / assurance
// (spec section 34) : seul le capital rembourse la dette, interets et
// assurance sont consommes. Remplace l'ancien /record-payment qui
// traitait a tort la mensualite entiere comme du capital rembourse.
loansRouter.post("/:id/payments", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides." });
    return;
  }
  const { totalAmount, interestAmount, insuranceAmount } = parsed.data;
  const principalAmount = totalAmount - interestAmount - insuranceAmount;

  if (!loanPaymentSplitIsValid({ totalAmount, principalAmount, interestAmount, insuranceAmount })) {
    res.status(400).json({ error: "Les intérêts et l'assurance ne peuvent pas dépasser le montant total de la mensualité." });
    return;
  }

  const newRemaining = applyLoanPayment(Number(result.loan.remainingBalance), principalAmount);

  const [loan] = await prisma.$transaction([
    prisma.loan.update({
      where: { id: result.loan.id },
      data: { remainingBalance: newRemaining, paidOff: newRemaining <= 0 },
    }),
    prisma.loanPayment.create({
      data: {
        loanId: result.loan.id,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        totalAmount,
        principalAmount,
        interestAmount,
        insuranceAmount,
      },
    }),
  ]);

  res.json({ loan: serializeLoan(loan) });
});

// Archive plutot que de supprimer (section 66 : "les suppressions
// importantes doivent privilegier l'archivage") — sinon la suppression
// SQL emporterait en cascade tout l'historique LoanPayment du pret.
loansRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  await prisma.loan.update({ where: { id: result.loan.id }, data: { archivedAt: new Date() } });
  res.status(204).send();
});

loansRouter.get("/archived", async (req, res) => {
  const loans = await prisma.loan.findMany({
    where: { userId: req.userId!, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
  });
  res.json({ loans: loans.map(serializeLoan) });
});

loansRouter.post("/:id/restore", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  const loan = await prisma.loan.update({ where: { id: result.loan.id }, data: { archivedAt: null } });
  res.json({ loan: serializeLoan(loan) });
});
