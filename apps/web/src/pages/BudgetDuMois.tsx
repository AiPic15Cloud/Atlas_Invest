import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { QuickAddExpense } from "../components/QuickAddExpense";
import { ImportStatement } from "../components/ImportStatement";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
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
  BESOINS: "#f59e0b",
  ENVIES: "#ec4899",
  EPARGNE: "#8b5cf6",
};

const CATEGORY_TEXT_CLASS: Record<BudgetCategory, string> = {
  BESOINS: "text-amber-600",
  ENVIES: "text-pink-600",
  EPARGNE: "text-violet-600",
};

const CATEGORY_ORDER: BudgetCategory[] = ["BESOINS", "ENVIES", "EPARGNE"];

function shiftMonth(year: number, month: number, delta: number) {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export function BudgetDuMois() {
  const currency = useCurrencyFormatter();
  const now = new Date();
  const [searchParams] = useSearchParams();
  const urlYear = Number(searchParams.get("year"));
  const urlMonth = Number(searchParams.get("month"));
  const [year, setYear] = useState(urlYear >= 2000 ? urlYear : now.getFullYear());
  const [month, setMonth] = useState(urlMonth >= 1 && urlMonth <= 12 ? urlMonth : now.getMonth() + 1);
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BudgetCategory | "ALL">("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyOtherOpen, setCopyOtherOpen] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState(year);
  const [copyFromMonth, setCopyFromMonth] = useState(month);
  const [importOpen, setImportOpen] = useState(false);
  const importSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (importOpen) {
      importSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [importOpen]);

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
    let list = data.expenses;
    if (categoryFilter !== "ALL") list = list.filter((e) => e.category === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.poste.toLowerCase().includes(q));
    return list;
  }, [data, search, categoryFilter]);

  const expensesByCategory = useMemo(() => {
    const groups = new Map<BudgetCategory, Expense[]>();
    for (const cat of CATEGORY_ORDER) groups.set(cat, []);
    for (const expense of filteredExpenses) {
      groups.get(expense.category)?.push(expense);
    }
    return groups;
  }, [filteredExpenses]);

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

  async function handleToggleWasteful(id: string, wasteful: boolean) {
    await apiFetch(`/api/expenses/${id}/wasteful`, { method: "PATCH", body: JSON.stringify({ wasteful }) });
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
  const unusualCount = data.expenses.filter((e) => e.unusual).length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">📅 Mon mois</h1>

      <div className="flex items-center justify-between card p-3">
        <button onClick={() => goToMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          ← Précédent
        </button>
        <span className="font-medium">{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={() => goToMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          Suivant →
        </button>
      </div>

      <section className="card">
        <h2 className="section-title text-sm">Actions rapides</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={handleCopyTemplate} className="btn btn-outline btn-sm">
            📁 Copier le budget type
          </button>
          <button onClick={handleCopyPreviousMonth} className="btn btn-outline btn-sm">
            ↩️ Copier le mois précédent
          </button>
          <button onClick={() => setCopyOtherOpen((v) => !v)} className="btn btn-outline btn-sm">
            🗓️ Copier un autre mois
          </button>
          <button onClick={() => setImportOpen((v) => !v)} className="btn btn-primary btn-sm">
            {importOpen ? "▲ Fermer l'import" : "📥 Importer un relevé"}
          </button>
          <button onClick={handleClearMonth} className="btn btn-danger btn-sm">
            Vider le mois
          </button>
        </div>
        {copyOtherOpen && (
          <div className="mt-3 flex items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Mois source</label>
              <select
                value={copyFromMonth}
                onChange={(e) => setCopyFromMonth(Number(e.target.value))}
                className="input px-2 py-1.5 text-sm"
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
              className="w-24 input px-2 py-1.5 text-sm"
              aria-label="Année source"
            />
            <button onClick={handleCopyOtherMonth} className="rounded-md bg-pink-600 hover:bg-pink-700 px-3 py-1.5 text-xs font-medium text-white">
              Copier
            </button>
          </div>
        )}
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
      </section>

      {importOpen && (
        <div ref={importSectionRef}>
          <ImportStatement
            year={year}
            month={month}
            accounts={availableAccounts}
            onDone={loadMonth}
            onClose={() => setImportOpen(false)}
          />
        </div>
      )}

      <section className="card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="💶 Revenu du mois" value={currency.format(summary.totalIncome)} />
          <StatTile label="💸 Dépensé ce mois" value={currency.format(summary.totalSpent)} />
          <StatTile
            label="📊 Écart vs budget type"
            value={ecart === null ? "—" : `${ecart > 0 ? "+" : ""}${currency.format(ecart)}`}
            tone={ecart === null ? "default" : ecart > 0 ? "warn" : "good"}
            hint={
              ecart === null
                ? undefined
                : ecart > 0
                  ? `Dépassé de ${currency.format(ecart)} ⚠️`
                  : "Sous ton budget type, bravo 💪"
            }
          />
          <StatTile
            label="🔍 Dépense inhabituelle"
            value={unusualCount === 0 ? "Aucune" : String(unusualCount)}
            tone={unusualCount === 0 ? "good" : "warn"}
            hint={unusualCount === 0 ? "Tout est dans les clous 👍" : "À vérifier ci-dessous"}
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

        {summary.wastefulTotal > 0 && (
          <div className="mt-3 rounded-md bg-orange-50 p-3 text-sm text-orange-700">
            <p>
              <span className="font-medium">{currency.format(summary.wastefulTotal)}</span> de dépenses jugées
              inutiles ce mois — autant de gain potentiel si elles étaient évitées. Corrige les marquages qui ne te
              semblent pas justes directement sur chaque dépense ci-dessous.
            </p>
          </div>
        )}

        {summary.budgetComparison && (
          <PrevuReelEcartTable summary={summary} budgetComparison={summary.budgetComparison} />
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

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Dépenses du mois</h2>
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as BudgetCategory | "ALL")}
              className="input px-2 py-1.5 text-sm"
              aria-label="Filtrer par catégorie"
            >
              <option value="ALL">Tous les postes</option>
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une dépense..."
              className="w-48 input px-3 py-1.5 text-sm"
              aria-label="Rechercher une dépense"
            />
          </div>
        </div>
        {filteredExpenses.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune dépense.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {CATEGORY_ORDER.map((cat) => {
              const items = expensesByCategory.get(cat) ?? [];
              if (items.length === 0) return null;
              const total = items.reduce((sum, e) => sum + Number(e.amount), 0);
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className={`text-sm font-bold ${CATEGORY_TEXT_CLASS[cat]}`}>{CATEGORY_LABELS[cat]}</h3>
                    <span className="text-xs font-medium text-slate-400">{currency.format(total)}</span>
                  </div>
                  <ul>
                    {items.map((expense) => (
                      <ExpenseRow key={expense.id} expense={expense} onDelete={handleDelete} onToggleWasteful={handleToggleWasteful} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ExpenseRow({
  expense,
  onDelete,
  onToggleWasteful,
}: {
  expense: Expense;
  onDelete: (id: string) => void;
  onToggleWasteful: (id: string, wasteful: boolean) => void;
}) {
  const currency = useCurrencyFormatter();
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
          {expense.wasteful && (
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-normal text-orange-700">
              inutile
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">{expense.bankAccountName}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{currency.format(Number(expense.amount))}</span>
        <button
          onClick={() => onToggleWasteful(expense.id, !expense.wasteful)}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          {expense.wasteful ? "Marquer utile" : "Marquer inutile"}
        </button>
        <button onClick={() => onDelete(expense.id)} className="text-xs text-slate-400 hover:text-red-600">
          Supprimer
        </button>
      </div>
    </li>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "good";
  hint?: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === "warn" ? "text-red-600" : tone === "good" ? "text-emerald-600" : ""
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className={`mt-0.5 text-xs ${tone === "warn" ? "text-red-600" : tone === "good" ? "text-emerald-600" : "text-slate-500"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

const CATEGORY_ROW_ICON: Record<BudgetCategory, string> = {
  BESOINS: "🏠",
  ENVIES: "💕",
  EPARGNE: "💰",
};

// Tableau comparatif Prévu / Réel / Écart plutôt qu'une liste de chiffres
// isolés : répond directement à "suis-je dans les clous ?" (spec section 4.2).
function PrevuReelEcartTable({
  summary,
  budgetComparison,
}: {
  summary: ExpensesResponse["summary"];
  budgetComparison: NonNullable<ExpensesResponse["summary"]["budgetComparison"]>;
}) {
  const currency = useCurrencyFormatter();
  const rows = (["BESOINS", "ENVIES", "EPARGNE"] as BudgetCategory[]).map((cat) => {
    const actual = summary.byCategory[cat.toLowerCase() as "besoins" | "envies" | "epargne"];
    const target =
      cat === "BESOINS"
        ? budgetComparison.besoinsTarget
        : cat === "ENVIES"
          ? budgetComparison.enviesTarget
          : budgetComparison.epargneTarget;
    return { cat, actual, target, ecart: actual - target };
  });

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 font-medium">Poste</th>
            <th className="py-2 text-right font-medium">Prévu</th>
            <th className="py-2 text-right font-medium">Réel</th>
            <th className="py-2 text-right font-medium">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cat, actual, target, ecart }) => {
            // Pour Besoins/Envies, dépasser la cible est le problème (écart > 0).
            // Pour Épargne c'est l'inverse : épargner MOINS que prévu est le
            // problème (écart < 0) — épargner plus n'est jamais une mauvaise
            // nouvelle.
            const over = cat === "EPARGNE" ? ecart < 0 : ecart > 0;
            return (
              <tr key={cat} className="border-b border-slate-100 last:border-0">
                <td className="py-2">
                  {CATEGORY_ROW_ICON[cat]} {CATEGORY_LABELS[cat]}
                </td>
                <td className="py-2 text-right text-slate-600">{currency.format(target)}</td>
                <td className="py-2 text-right font-medium">{currency.format(actual)}</td>
                <td className={`py-2 text-right font-medium ${over ? "text-red-600" : "text-emerald-600"}`}>
                  {ecart > 0 ? "+" : ""}
                  {currency.format(ecart)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
