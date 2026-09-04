import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { DashboardResponse, ExpensesResponse, IncomeSummary, Income } from "../api/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
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
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [monthData, setMonthData] = useState<{ expenses: ExpensesResponse; incomes: Income[] } | null>(null);
  const [yearIncomeSummary, setYearIncomeSummary] = useState<IncomeSummary | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [expenses, incomesRes, dashboardRes, incomeSummary] = await Promise.all([
        apiFetch<ExpensesResponse>(`/api/expenses?year=${year}&month=${month}`),
        apiFetch<{ incomes: Income[] }>(`/api/incomes?year=${year}&month=${month}`),
        apiFetch<DashboardResponse>(`/api/dashboard?year=${year}`),
        apiFetch<IncomeSummary>(`/api/incomes/summary?year=${year}`),
      ]);
      setMonthData({ expenses, incomes: incomesRes.incomes });
      setDashboard(dashboardRes);
      setYearIncomeSummary(incomeSummary);
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
      ["Type", "Poste / Source", "Catégorie", "Montant (€)", "Compte", "Marqué inutile"],
      ...monthData.incomes.map((i) => ["Revenu", i.source, "", i.amount, i.bankAccountName, ""]),
      ...monthData.expenses.expenses.map((e) => [
        "Dépense",
        e.poste,
        e.category,
        e.amount,
        e.bankAccountName,
        e.wasteful ? "Oui" : "Non",
      ]),
      [],
      ["Total revenus", "", "", monthData.expenses.summary.totalIncome, "", ""],
      ["Total dépenses", "", "", monthData.expenses.summary.totalSpent, "", ""],
      ["Reste à vivre", "", "", monthData.expenses.summary.totalIncome - monthData.expenses.summary.totalSpent, "", ""],
    ];
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
    <div className="space-y-6">
      <div className="flex items-center justify-between card p-3">
        <button onClick={() => shiftMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          ← Précédent
        </button>
        <span className="text-lg font-semibold">
          Export et rapport — {MONTH_LABELS[month - 1]} {year}
        </span>
        <button onClick={() => shiftMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
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
            <button
              onClick={handleDownloadMonth}
              className="mt-3 rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white"
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
              className="mt-3 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Télécharger le récapitulatif annuel (CSV)
            </button>
          </section>
        </>
      )}
    </div>
  );
}
