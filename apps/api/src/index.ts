import "dotenv/config";
import express from "express";
import "express-async-errors";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { householdsRouter } from "./routes/households.js";
import { bankAccountsRouter } from "./routes/bankAccounts.js";
import { incomesRouter } from "./routes/incomes.js";
import { budgetTemplateRouter } from "./routes/budgetTemplate.js";
import { expensesRouter } from "./routes/expenses.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { emergencyFundRouter } from "./routes/emergencyFund.js";
import { subscriptionsRouter } from "./routes/subscriptions.js";
import { savingsOpportunitiesRouter } from "./routes/savingsOpportunities.js";
import { recurringChargesRouter } from "./routes/recurringCharges.js";
import { provisionsRouter } from "./routes/provisions.js";
import { wealthRouter } from "./routes/wealth.js";
import { savingsGoalsRouter } from "./routes/savingsGoals.js";
import { householdSplitRouter } from "./routes/householdSplit.js";
import { correctionHistoryRouter } from "./routes/correctionHistory.js";
import { twoFactorRouter } from "./routes/twoFactor.js";
import { loansRouter } from "./routes/loans.js";
import { monthlyGoalsRouter } from "./routes/monthlyGoals.js";
import { importMemoryRouter } from "./routes/importMemory.js";
import { transfersRouter } from "./routes/transfers.js";
import { riskyMonthsRouter } from "./routes/riskyMonths.js";

const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/households", householdsRouter);
app.use("/api/bank-accounts", bankAccountsRouter);
app.use("/api/incomes", incomesRouter);
app.use("/api/budget-template", budgetTemplateRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/emergency-fund", emergencyFundRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/savings-opportunities", savingsOpportunitiesRouter);
app.use("/api/recurring-charges", recurringChargesRouter);
app.use("/api/provisions", provisionsRouter);
app.use("/api/wealth", wealthRouter);
app.use("/api/savings-goals", savingsGoalsRouter);
app.use("/api/household-split", householdSplitRouter);
app.use("/api/correction-history", correctionHistoryRouter);
app.use("/api/2fa", twoFactorRouter);
app.use("/api/loans", loansRouter);
app.use("/api/monthly-goals", monthlyGoalsRouter);
app.use("/api/import-memory", importMemoryRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/risky-months", riskyMonthsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API budget-foyer démarrée sur le port ${port}`);
});
