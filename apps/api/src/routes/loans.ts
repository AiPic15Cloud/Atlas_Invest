import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { applyLoanPayment, loanPaymentSplitIsValid } from "../utils/loanPayment.js";
import type { Loan, LoanPayment } from "@prisma/client";

export const loansRouter = Router();

loansRouter.use(requireAuth);

function serializeLoan(loan: Loan) {
  const principal = Number(loan.principalAmount);
  const remaining = Number(loan.remainingBalance);
  const monthlyPayment = Number(loan.monthlyPayment);
  const interestRate = loan.interestRate !== null ? Number(loan.interestRate) : null;

  const paidOff = loan.paidOff || remaining <= 0;

  let monthsRemaining: number | null = null;
  if (!paidOff && monthlyPayment > 0) {
    monthsRemaining = Math.ceil(remaining / monthlyPayment);
  }

  let projectedPayoffDate: Date | null = null;
  if (!paidOff && monthsRemaining !== null) {
    const now = new Date();
    projectedPayoffDate = new Date(now.getFullYear(), now.getMonth() + monthsRemaining, 1);
  }

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
    createdAt: loan.createdAt,
  };
}

export async function loansFor(userId: string) {
  return prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export function loansRemainingTotal(loans: Loan[]) {
  return loans.reduce((sum, l) => sum + (l.paidOff ? 0 : Number(l.remainingBalance)), 0);
}

loansRouter.get("/", async (req, res) => {
  const loans = await loansFor(req.userId!);
  res.json({ loans: loans.map(serializeLoan) });
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

loansRouter.delete("/:id", async (req, res) => {
  const result = await loadOwnLoan(req.userId!, req.params.id);
  if ("error" in result) {
    res.status(404).json({ error: "Prêt introuvable." });
    return;
  }
  await prisma.loan.delete({ where: { id: result.loan.id } });
  res.status(204).send();
});
