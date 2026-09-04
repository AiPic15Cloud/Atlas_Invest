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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API budget-foyer démarrée sur le port ${port}`);
});
