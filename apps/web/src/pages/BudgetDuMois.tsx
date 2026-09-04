import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { QuickAddExpense } from "../components/QuickAddExpense";
import { ImportStatement } from "../components/ImportStatement";
import type { BankAccountsResponse, BudgetCategory, Expense, ExpensesResponse } from "../api/types";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
};

const CATEGORY_COLORS: Record<BudgetCategory, string> = {
  BESOINS: "#334155",
  ENVIES: "#94a3b8",
  EPARGNE: "#10b981",
};

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function shiftMonth(year: number, month: number, delta: number) {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export function BudgetDuMois() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyOtherOpen, setCopyOtherOpen] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState(year);
  const [copyFromMonth, setCopyFromMonth] = useState(month);
  const [importOpen, setImportOpen] = useState(false);

  async function loadMonth() {
    try {
      const res = await apiFetch<ExpensesResponse>(`/api/expenses?year=${year}&month=${month}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les dépenses.");
    }
  }

  async function loadAccounts() {
    const res = await apiFetch<BankAccountsResponse>("/api/bank-accounts");
    setAccounts(res);
  }

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const availableAccounts = useMemo(() => [...(accounts?.mine ?? []), ...(accounts?.joint ?? [])], [accounts]);

  const filteredExpenses = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.expenses;
    const q = search.trim().toLowerCase();
    return data.expenses.filter((e) => e.poste.toLowerCase().includes(q));
  }, [data, search]);

  function goToMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  async function handleQuickAdd(item: { poste: string; amount: number; category: BudgetCategory; bankAccountId: string }) {
    await apiFetch("/api/expenses", { method: "POST", body: JSON.stringify({ ...item, year, month }) });
    await loadMonth();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
    await loadMonth();
  }

  async function handleCopyTemplate() {
    const account = availableAccounts[0];
    if (!account) {
      setActionError("Ajoute d'abord un compte bancaire.");
      return;
    }
    if (!confirm(`Remplacer les dépenses de ${MONTH_NAMES[month - 1]} ${year} par les postes de ton budget type ?`)) return;
    setActionError(null);
    try {
      await apiFetch("/api/expenses/copy-budget-template", {
        method: "POST",
        body: JSON.stringify({ year, month, bankAccountId: account.id }),
      });
      await loadMonth();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleCopyPreviousMonth() {
    const prev = shiftMonth(year, month, -1);
    if (!confirm(`Remplacer les dépenses de ${MONTH_NAMES[month - 1]} ${year} par celles de ${MONTH_NAMES[prev.month - 1]} ${prev.year} ?`)) return;
    setActionError(null);
    try {
      await apiFetch("/api/expenses/copy-month", {
        method: "POST",
        body: JSON.stringify({ fromYear: prev.year, fromMonth: prev.month, toYear: year, toMonth: month }),
      });
      await loadMonth();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleCopyOtherMonth() {
    if (copyFromYear === year && copyFromMonth === month) {
      setActionError("Choisis un mois différent du mois affiché.");
      return;
    }
    if (!confirm(`Remplacer les dépenses de ${MONTH_NAMES[month - 1]} ${year} par celles de ${MONTH_NAMES[copyFromMonth - 1]} ${copyFromYear} ?`)) return;
    setActionError(null);
    try {
      await apiFetch("/api/expenses/copy-month", {
        method: "POST",
        body: JSON.stringify({ fromYear: copyFromYear, fromMonth: copyFromMonth, toYear: year, toMonth: month }),
      });
      setCopyOtherOpen(false);
      await loadMonth();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleClearMonth() {
    if (!confirm(`Vider toutes les dépenses de ${MONTH_NAMES[month - 1]} ${year} ?`)) return;
    setActionError(null);
    await apiFetch("/api/expenses/clear-month", { method: "POST", body: JSON.stringify({ year, month }) });
    await loadMonth();
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  const { summary } = data;
  const ecart = summary.budgetComparison
    ? summary.totalSpent - (summary.budgetComparison.besoinsTarget + summary.budgetComparison.enviesTarget + summary.budgetComparison.epargneTarget)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Budget du mois</h1>

      <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <button onClick={() => goToMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          ← Précédent
        </button>
        <span className="font-medium">{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={() => goToMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          Suivant →
        </button>
      </div>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Revenu du mois" value={currency.format(summary.totalIncome)} />
          <StatTile label="Dépensé ce mois" value={currency.format(summary.totalSpent)} />
          <StatTile
            label="Écart vs budget type"
            value={ecart === null ? "—" : `${ecart > 0 ? "+" : ""}${currency.format(ecart)}`}
            tone={ecart !== null && ecart > 0 ? "warn" : "default"}
          />
        </div>
        {!summary.budgetComparison && (
          <p className="mt-2 text-xs text-slate-500">
            Crée ton budget type (avec une méthode à cibles fixes) pour voir l'écart ici.
          </p>
        )}

        {summary.budgetComparison && summary.budgetComparison.overBudgetCategories.length > 0 && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Budget dépassé :</p>
            <ul className="mt-1 list-disc pl-5">
              {summary.budgetComparison.overBudgetCategories.map((c) => (
                <li key={c.category}>
                  {CATEGORY_LABELS[c.category]} : {currency.format(c.actual)} pour une cible de {currency.format(c.target)}{" "}
                  (+{currency.format(c.overBy)})
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.budgetComparison && (
          <div className="mt-4 space-y-3">
            {(["BESOINS", "ENVIES", "EPARGNE"] as BudgetCategory[]).map((cat) => (
              <BudgetVsActualBar
                key={cat}
                label={CATEGORY_LABELS[cat]}
                actual={summary.byCategory[cat.toLowerCase() as "besoins" | "envies" | "epargne"]}
                target={
                  cat === "BESOINS"
                    ? summary.budgetComparison!.besoinsTarget
                    : cat === "ENVIES"
                      ? summary.budgetComparison!.enviesTarget
                      : summary.budgetComparison!.epargneTarget
                }
              />
            ))}
          </div>
        )}

        {summary.totalSpent > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div
              className="h-24 w-24 shrink-0 rounded-full"
              style={{ background: buildDonutGradient(summary.byCategory) }}
              role="img"
              aria-label="Répartition réelle des dépenses par catégorie"
            />
            <ul className="text-xs text-slate-600">
              {(["besoins", "envies", "epargne"] as const).map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[key.toUpperCase() as BudgetCategory] }}
                  />
                  {CATEGORY_LABELS[key.toUpperCase() as BudgetCategory]} — {currency.format(summary.byCategory[key])} (
                  {summary.totalSpent > 0 ? Math.round((summary.byCategory[key] / summary.totalSpent) * 100) : 0}%)
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <QuickAddExpense accounts={availableAccounts} onSubmit={handleQuickAdd} />

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Actions rapides</h2>
          <button onClick={() => setActionsOpen((v) => !v)} className="text-sm font-medium text-slate-900 underline">
            {actionsOpen ? "Masquer" : "Afficher"}
          </button>
        </div>
        {actionsOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={handleCopyTemplate} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
              Copier le budget type
            </button>
            <button onClick={handleCopyPreviousMonth} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
              Copier le mois précédent
            </button>
            <button onClick={() => setCopyOtherOpen((v) => !v)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
              Copier un autre mois
            </button>
            <button onClick={() => setImportOpen((v) => !v)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
              Importer un relevé
            </button>
            <button onClick={handleClearMonth} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
              Vider le mois
            </button>
          </div>
        )}
        {actionsOpen && copyOtherOpen && (
          <div className="mt-3 flex items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Mois source</label>
              <select
                value={copyFromMonth}
                onChange={(e) => setCopyFromMonth(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
            <input
              type="number"
              value={copyFromYear}
              onChange={(e) => setCopyFromYear(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              aria-label="Année source"
            />
            <button onClick={handleCopyOtherMonth} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
              Copier
            </button>
          </div>
        )}
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
      </section>

      {importOpen && (
        <ImportStatement
          year={year}
          month={month}
          accounts={availableAccounts}
          onDone={loadMonth}
          onClose={() => setImportOpen(false)}
        />
      )}

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Dépenses du mois</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par poste..."
            className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            aria-label="Filtrer les dépenses par poste"
          />
        </div>
        {filteredExpenses.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune dépense.</p>
        ) : (
          <ul className="mt-2">
            {filteredExpenses.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExpenseRow({ expense, onDelete }: { expense: Expense; onDelete: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">
          {expense.poste}
          {expense.unusual && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-700">
              inhabituelle
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {CATEGORY_LABELS[expense.category]} · {expense.bankAccountName}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{currency.format(Number(expense.amount))}</span>
        <button onClick={() => onDelete(expense.id)} className="text-xs text-slate-400 hover:text-red-600">
          Supprimer
        </button>
      </div>
    </li>
  );
}

function StatTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "warn" ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}

function BudgetVsActualBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = target > 0 ? actual / target : actual > 0 ? 1 : 0;
  const width = Math.min(pct, 1) * 100;
  const over = actual > target;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className={over ? "font-medium text-red-600" : ""}>
          {currency.format(actual)} / cible {currency.format(target)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div style={{ width: `${width}%` }} className={`h-full ${over ? "bg-red-500" : "bg-emerald-500"}`} />
      </div>
    </div>
  );
}

function buildDonutGradient(byCategory: { besoins: number; envies: number; epargne: number }) {
  const total = byCategory.besoins + byCategory.envies + byCategory.epargne;
  if (total <= 0) return "#e2e8f0";
  const besoinsPct = (byCategory.besoins / total) * 100;
  const enviesPct = (byCategory.envies / total) * 100;
  return `conic-gradient(${CATEGORY_COLORS.BESOINS} 0% ${besoinsPct}%, ${CATEGORY_COLORS.ENVIES} ${besoinsPct}% ${besoinsPct + enviesPct}%, ${CATEGORY_COLORS.EPARGNE} ${besoinsPct + enviesPct}% 100%)`;
}
