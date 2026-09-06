import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconDownload } from "../components/icons";
import type {
  DashboardResponse,
  ExpensesResponse,
  IncomeSummary,
  Income,
  SavingsOpportunities,
  SavingsGoalsResponse,
  WealthResponse,
  LoansResponse,
  SavedEurosResponse,
} from "../api/types";

const BUDGET_CATEGORY_LABELS: Record<string, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
};

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(";"),
    )
    .join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function Export() {
  const currency = useCurrencyFormatter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [monthData, setMonthData] = useState<{ expenses: ExpensesResponse; incomes: Income[] } | null>(null);
  const [yearIncomeSummary, setYearIncomeSummary] = useState<IncomeSummary | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [opportunities, setOpportunities] = useState<SavingsOpportunities | null>(null);
  const [goals, setGoals] = useState<SavingsGoalsResponse | null>(null);
  const [wealth, setWealth] = useState<WealthResponse | null>(null);
  const [loans, setLoans] = useState<LoansResponse | null>(null);
  const [savedEuros, setSavedEuros] = useState<SavedEurosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [expenses, incomesRes, dashboardRes, incomeSummary, opportunitiesRes, goalsRes, wealthRes, loansRes, savedEurosRes] =
        await Promise.all([
          apiFetch<ExpensesResponse>(`/api/expenses?year=${year}&month=${month}`),
          apiFetch<{ incomes: Income[] }>(`/api/incomes?year=${year}&month=${month}`),
          apiFetch<DashboardResponse>(`/api/dashboard?year=${year}`),
          apiFetch<IncomeSummary>(`/api/incomes/summary?year=${year}`),
          apiFetch<SavingsOpportunities>(`/api/savings-opportunities?year=${year}`),
          apiFetch<SavingsGoalsResponse>(`/api/savings-goals`),
          apiFetch<WealthResponse>(`/api/wealth`),
          apiFetch<LoansResponse>(`/api/loans`),
          apiFetch<SavedEurosResponse>(`/api/saved-euros`),
        ]);
      setMonthData({ expenses, incomes: incomesRes.incomes });
      setDashboard(dashboardRes);
      setYearIncomeSummary(incomeSummary);
      setOpportunities(opportunitiesRes);
      setGoals(goalsRes);
      setWealth(wealthRes);
      setLoans(loansRes);
      setSavedEuros(savedEurosRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les données du rapport.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  function handleDownloadMonth() {
    if (!monthData) return;
    const rows: (string | number)[][] = [
      ["Type", "Poste / Source", "Catégorie", "Montant (€)", "Compte", "Ressenti"],
      ...monthData.incomes.map((i) => ["Revenu", i.source, "", i.amount, i.bankAccountName, ""]),
      ...monthData.expenses.expenses.map((e) => [
        "Dépense",
        e.poste,
        e.category,
        e.amount,
        e.bankAccountName,
        e.feeling ?? "",
      ]),
      [],
      ["Total revenus", "", "", monthData.expenses.summary.totalIncome, "", ""],
      ["Total dépenses", "", "", monthData.expenses.summary.totalSpent, "", ""],
      ["Reste à vivre", "", "", monthData.expenses.summary.totalIncome - monthData.expenses.summary.totalSpent, "", ""],
      ["Épargne du mois", "", "EPARGNE", monthData.expenses.summary.byCategory.epargne, "", ""],
    ];

    const comparison = monthData.expenses.summary.budgetComparison;
    if (comparison) {
      rows.push([], ["Budget vs réel", "Catégorie", "Cible", "Réel", "Écart", ""]);
      for (const col of comparison.columns) {
        rows.push([
          "",
          BUDGET_CATEGORY_LABELS[col.category] ?? col.category,
          col.thisMonth,
          col.actual,
          col.actual - col.thisMonth,
          "",
        ]);
      }
    }

    if (savedEuros) {
      const monthEvents = savedEuros.events.filter((e) => {
        const d = new Date(e.createdAt);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      rows.push([], ["Euros sauvés ce mois", "Description", "Affectation", "Montant (€)", "", ""]);
      for (const e of monthEvents) {
        rows.push(["", e.description, e.allocation, e.amount, "", ""]);
      }
      if (monthEvents.length === 0) rows.push(["", "Aucun euro sauvé enregistré ce mois-ci.", "", "", "", ""]);
    }

    if (opportunities) {
      rows.push(
        [],
        [
          "Fuites potentielles (non confirmées)",
          "Poste",
          "Statut",
          "Montant mensuel (€)",
          "Coût annuel (€)",
          "",
        ],
      );
      for (const item of opportunities.potentialLeaks.items) {
        rows.push(["", item.poste, item.status, item.monthlyAmount, item.annualCost, ""]);
      }
      rows.push(
        [],
        ["Actions proposées (économies confirmées)", "Poste", "", "Montant mensuel (€)", "Coût annuel (€)", ""],
      );
      for (const s of opportunities.subscriptionsToCancel) {
        rows.push(["Abonnement à résilier", s.poste, "", s.monthlyAmount, s.annualCost, ""]);
      }
      for (const r of opportunities.regret.byPoste) {
        rows.push(["Dépense regrettée", r.poste, "", "", r.total, ""]);
      }
    }

    if (goals) {
      rows.push([], ["Objectifs d'épargne", "Nom", "Cible (€)", "Actuel (€)", "Restant (€)", ""]);
      for (const g of goals.goals) {
        rows.push(["", g.name, g.targetAmount, g.currentAmount, g.remaining, ""]);
      }
    }

    if (wealth?.mine) {
      rows.push(
        [],
        ["Patrimoine (instantané à la date du rapport)", "", "", "", "", ""],
        ["", "Solde des comptes", "", wealth.mine.bankAccountsTotal, "", ""],
        ["", "Actifs (biens, placements...)", "", wealth.mine.wealthItemsTotal, "", ""],
        ["", "Dettes restantes", "", wealth.mine.loansTotal, "", ""],
        ["", "Patrimoine net", "", wealth.mine.netWorth, "", ""],
      );
    }

    if (loans) {
      const activeLoans = loans.loans.filter((l) => !l.paidOff);
      rows.push([], ["Crédits en cours", "Libellé", "Restant dû (€)", "Mensualité (€)", "Taux (%)", ""]);
      for (const l of activeLoans) {
        rows.push(["", l.label, l.remainingBalance, l.monthlyPayment, l.interestRate ?? "inconnu", ""]);
      }
      if (activeLoans.length === 0) rows.push(["", "Aucun crédit en cours.", "", "", "", ""]);
    }

    downloadCsv(`rapport-${year}-${String(month).padStart(2, "0")}.csv`, rows);
  }

  function handleDownloadYear() {
    if (!dashboard || !yearIncomeSummary) return;
    const rows: (string | number)[][] = [
      ["Mois", "Revenus (€)", "Dépenses (€)", "Reste à vivre (€)"],
      ...dashboard.monthly.map((m) => [MONTH_LABELS[m.month - 1], m.income, m.expense, m.reste]),
      [],
      ["Total annuel", dashboard.totals.income, dashboard.totals.expenses, dashboard.totals.reste],
    ];
    downloadCsv(`rapport-annuel-${year}.csv`, rows);
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <IconDownload className="h-6 w-6 text-violet-600" />
        Export et rapport
      </h1>

      <div className="flex items-center justify-between card p-3">
        <button onClick={() => shiftMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          ← Précédent
        </button>
        <span className="font-medium">
          {MONTH_LABELS[month - 1]} {year}
        </span>
        <button onClick={() => shiftMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          Suivant →
        </button>
      </div>

      {!monthData || !dashboard ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : (
        <>
          <section className="card">
            <h2 className="font-semibold">Rapport du mois</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Revenus</p>
                <p className="text-lg font-medium">{currency.format(monthData.expenses.summary.totalIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dépenses</p>
                <p className="text-lg font-medium">{currency.format(monthData.expenses.summary.totalSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reste à vivre</p>
                <p className="text-lg font-medium">
                  {currency.format(monthData.expenses.summary.totalIncome - monthData.expenses.summary.totalSpent)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {monthData.incomes.length} revenu(s) et {monthData.expenses.expenses.length} dépense(s) enregistrés ce
              mois-ci.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-2">
              <li>Épargne du mois : {currency.format(monthData.expenses.summary.byCategory.epargne)}</li>
              <li>
                Euros sauvés :{" "}
                {savedEuros
                  ? savedEuros.events.filter((e) => {
                      const d = new Date(e.createdAt);
                      return d.getFullYear() === year && d.getMonth() + 1 === month;
                    }).length
                  : 0}{" "}
                évènement(s)
              </li>
              <li>Fuites potentielles : {opportunities?.potentialLeaks.items.length ?? 0}</li>
              <li>Objectifs suivis : {goals?.goals.length ?? 0}</li>
              <li>Patrimoine net : {wealth?.mine ? currency.format(wealth.mine.netWorth) : "—"}</li>
              <li>Crédits en cours : {loans?.loans.filter((l) => !l.paidOff).length ?? 0}</li>
            </ul>
            <button
              onClick={handleDownloadMonth}
              className="mt-3 rounded-md bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-medium text-white"
            >
              Télécharger le rapport du mois (CSV)
            </button>
          </section>

          <section className="card">
            <h2 className="font-semibold">Rapport annuel {year}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Total revenus</p>
                <p className="text-lg font-medium">{currency.format(dashboard.totals.income)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total dépenses</p>
                <p className="text-lg font-medium">{currency.format(dashboard.totals.expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reste à vivre cumulé</p>
                <p className="text-lg font-medium">{currency.format(dashboard.totals.reste)}</p>
              </div>
            </div>
            <button
              onClick={handleDownloadYear}
              className="mt-3 rounded-md bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Télécharger le récapitulatif annuel (CSV)
            </button>
          </section>
        </>
      )}
    </div>
  );
}
