import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { QuickAddExpense } from "../components/QuickAddExpense";
import { ImportStatement } from "../components/ImportStatement";
import { WaterfallChart } from "../components/WaterfallChart";
import { StatTile } from "../components/StatTile";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconCalendar, IconTrendingUp, IconWallet, IconChartBar, IconFlag } from "../components/icons";
import type { BankAccountsResponse, BudgetCategory, Expense, ExpenseCategory, ExpenseFeeling, ExpensesResponse } from "../api/types";

const FEELING_EMOJI: Record<ExpenseFeeling, string> = {
  SATISFAIT: "😊",
  NEUTRE: "😐",
  REGRET: "😬",
};

const FEELING_LABELS: Record<ExpenseFeeling, string> = {
  SATISFAIT: "Satisfait",
  NEUTRE: "Neutre",
  REGRET: "Regretté",
};

const FEELING_ORDER: ExpenseFeeling[] = ["SATISFAIT", "NEUTRE", "REGRET"];

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
  INVESTISSEMENT: "Investissement",
  REMBOURSEMENT_DETTE: "Remboursement de dette",
};

const CATEGORY_TEXT_CLASS: Record<ExpenseCategory, string> = {
  BESOINS: "text-amber-600",
  ENVIES: "text-pink-600",
  EPARGNE: "text-violet-600",
  INVESTISSEMENT: "text-sky-600",
  REMBOURSEMENT_DETTE: "text-slate-600 dark:text-slate-400",
};

const CATEGORY_ORDER: ExpenseCategory[] = ["BESOINS", "ENVIES", "EPARGNE", "INVESTISSEMENT", "REMBOURSEMENT_DETTE"];

// Avatar circulaire par poste (spec design : puce colorée devant chaque
// ligne, dans l'esprit des listes de transactions des références) —
// mêmes couleurs que CATEGORY_TEXT_CLASS, juste en fond teinté.
const CATEGORY_AVATAR_CLASS: Record<ExpenseCategory, string> = {
  BESOINS: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  ENVIES: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  EPARGNE: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  INVESTISSEMENT: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  REMBOURSEMENT_DETTE: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

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
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "ALL">("ALL");
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
    const groups = new Map<ExpenseCategory, Expense[]>();
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

  async function handleQuickAdd(item: { poste: string; amount: number; category: ExpenseCategory; bankAccountId: string }) {
    await apiFetch("/api/expenses", { method: "POST", body: JSON.stringify({ ...item, year, month }) });
    await loadMonth();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
    await loadMonth();
  }

  async function handleSetFeeling(id: string, feeling: ExpenseFeeling) {
    await apiFetch(`/api/expenses/${id}/feeling`, { method: "PATCH", body: JSON.stringify({ feeling }) });
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
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <IconCalendar className="h-6 w-6 text-violet-600" />
        Mon mois
      </h1>

      <div className="flex items-center justify-between card p-3">
        <button onClick={() => goToMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          ← Précédent
        </button>
        <span className="font-medium">{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={() => goToMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          Suivant →
        </button>
      </div>

      <section className="card">
        <h2 className="section-title text-sm">Actions rapides</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={handleCopyTemplate} className="btn btn-outline btn-sm">
            Copier le budget type
          </button>
          <button onClick={handleCopyPreviousMonth} className="btn btn-outline btn-sm">
            Copier le mois précédent
          </button>
          <button onClick={() => setCopyOtherOpen((v) => !v)} className="btn btn-outline btn-sm">
            Copier un autre mois
          </button>
          <button onClick={() => setImportOpen((v) => !v)} className="btn btn-primary btn-sm">
            {importOpen ? "Fermer l'import" : "Importer un relevé"}
          </button>
          <button onClick={handleClearMonth} className="btn btn-danger btn-sm">
            Vider le mois
          </button>
        </div>
        {copyOtherOpen && (
          <div className="mt-3 flex items-end gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Mois source</label>
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
            <button onClick={handleCopyOtherMonth} className="rounded-md bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-medium text-white">
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
          <StatTile
            icon={IconTrendingUp}
            label="Revenu du mois"
            value={currency.format(summary.totalIncome)}
            color="emerald"
          />
          <StatTile
            icon={IconWallet}
            label="Dépensé ce mois"
            value={currency.format(summary.totalSpent)}
            color="rose"
          />
          <StatTile
            icon={IconChartBar}
            label="Écart vs budget type"
            value={ecart === null ? "—" : `${ecart > 0 ? "+" : ""}${currency.format(ecart)}`}
            color="sky"
            tone={ecart === null ? "default" : ecart > 0 ? "warn" : "good"}
            hint={
              ecart === null
                ? undefined
                : ecart > 0
                  ? `Dépassé de ${currency.format(ecart)}`
                  : "Sous ton budget type, bravo"
            }
          />
          <StatTile
            icon={IconFlag}
            label="Dépense inhabituelle"
            value={unusualCount === 0 ? "Aucune" : String(unusualCount)}
            color="amber"
            tone={unusualCount === 0 ? "good" : "warn"}
            hint={unusualCount === 0 ? "Tout est dans les clous" : "À vérifier ci-dessous"}
          />
        </div>
        {!summary.budgetComparison && (
          <p className="mt-2 text-xs text-slate-500">
            Crée ton budget type (avec une méthode à cibles fixes) pour voir l'écart ici.
          </p>
        )}

        {summary.budgetComparison && summary.budgetComparison.overBudgetCategories.length > 0 && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
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

        {summary.regretTotal > 0 && (
          <div className="mt-3 rounded-md bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
            <p>
              <span className="font-medium">{currency.format(summary.regretTotal)}</span> de dépenses regrettées
              (😬) ce mois — autant de gain potentiel si elles étaient évitées. Ajuste le ressenti qui ne te semble
              pas juste directement sur chaque dépense ci-dessous.
            </p>
          </div>
        )}

        {summary.budgetComparison && (
          <MonthlyComparisonTable columns={summary.budgetComparison.columns} year={year} month={month} onChanged={loadMonth} />
        )}

        {(summary.totalIncome > 0 || summary.totalSpent > 0) && (
          <div className="mt-4">
            <WaterfallChart
              income={summary.totalIncome}
              besoins={summary.byCategory.besoins}
              envies={summary.byCategory.envies}
              epargne={summary.byCategory.epargne}
              autres={Math.max(
                0,
                summary.totalSpent - summary.byCategory.besoins - summary.byCategory.envies - summary.byCategory.epargne,
              )}
            />
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
              onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | "ALL")}
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
                      <ExpenseRow key={expense.id} expense={expense} onDelete={handleDelete} onSetFeeling={handleSetFeeling} />
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
  onSetFeeling,
}: {
  expense: Expense;
  onDelete: (id: string) => void;
  onSetFeeling: (id: string, feeling: ExpenseFeeling) => void;
}) {
  const currency = useCurrencyFormatter();
  return (
    <li className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${CATEGORY_AVATAR_CLASS[expense.category]}`}
          aria-hidden="true"
        >
          {expense.poste.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium">
            {expense.poste}
            {expense.unusual && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                inhabituelle
              </span>
            )}
            {expense.feeling === "REGRET" && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-normal text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                regrettée
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">{expense.bankAccountName}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{currency.format(Number(expense.amount))}</span>
        <div className="flex gap-0.5" role="group" aria-label="Ressenti sur cette dépense">
          {FEELING_ORDER.map((feeling) => (
            <button
              key={feeling}
              onClick={() => onSetFeeling(expense.id, feeling)}
              title={FEELING_LABELS[feeling]}
              aria-pressed={expense.feeling === feeling}
              className={`rounded-full px-1 py-0.5 text-sm leading-none transition ${
                expense.feeling === feeling ? "bg-slate-200 dark:bg-slate-700" : "opacity-40 hover:opacity-100"
              }`}
            >
              {FEELING_EMOJI[feeling]}
            </button>
          ))}
        </div>
        <button onClick={() => onDelete(expense.id)} className="text-xs text-slate-400 hover:text-red-600">
          Supprimer
        </button>
      </div>
    </li>
  );
}

const CATEGORY_ROW_DOT: Record<BudgetCategory, string> = {
  BESOINS: "bg-amber-500",
  ENVIES: "bg-pink-500",
  EPARGNE: "bg-violet-500",
};

// Tableau à 4 colonnes (spec 4.2) plutôt qu'une liste de chiffres isolés :
// Référence (le budget type) / Ce mois (ce qui a été décidé pour ce mois,
// modifiable ponctuellement sans toucher au budget type) / Réel à date /
// Projection fin de mois (extrapolation au rythme actuel).
function MonthlyComparisonTable({
  columns,
  year,
  month,
  onChanged,
}: {
  columns: NonNullable<ExpensesResponse["summary"]["budgetComparison"]>["columns"];
  year: number;
  month: number;
  onChanged: () => Promise<void>;
}) {
  const currency = useCurrencyFormatter();
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(cat: BudgetCategory, current: number) {
    setEditing(cat);
    setDraft(String(current));
  }

  async function saveEdit(cat: BudgetCategory) {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/expenses/monthly-target", {
        method: "PUT",
        body: JSON.stringify({ year, month, category: cat, amount: parsed }),
      });
      await onChanged();
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  async function resetToReference(cat: BudgetCategory) {
    setSaving(true);
    try {
      await apiFetch("/api/expenses/monthly-target", {
        method: "PUT",
        body: JSON.stringify({ year, month, category: cat, amount: null }),
      });
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 font-medium">Poste</th>
            <th className="py-2 text-right font-medium">Référence</th>
            <th className="py-2 text-right font-medium">Ce mois</th>
            <th className="py-2 text-right font-medium">Réel à date</th>
            <th className="py-2 text-right font-medium">Projection</th>
          </tr>
        </thead>
        <tbody>
          {columns.map(({ category, reference, thisMonth, hasOverride, actual, projection }) => {
            // Pour Besoins/Envies, projeter au-dela de la cible du mois est le
            // problème ; pour Épargne c'est l'inverse : projeter en dessous.
            const projectionOver = category === "EPARGNE" ? projection < thisMonth : projection > thisMonth;
            return (
              <tr key={category} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-2">
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_ROW_DOT[category]}`} />
                    {CATEGORY_LABELS[category]}
                  </span>
                </td>
                <td className="py-2 text-right text-slate-500">{currency.format(reference)}</td>
                <td className="py-2 text-right">
                  {editing === category ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => saveEdit(category)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(category)}
                      disabled={saving}
                      className="w-24 input px-1.5 py-0.5 text-right text-sm"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => startEdit(category, thisMonth)}
                        className={`font-medium hover:underline ${hasOverride ? "text-pink-600" : ""}`}
                        title="Modifier la cible de ce mois"
                      >
                        {currency.format(thisMonth)}
                      </button>
                      {hasOverride && (
                        <button
                          onClick={() => resetToReference(category)}
                          className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                          title="Revenir à la référence"
                        >
                          ↺
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-medium">{currency.format(actual)}</td>
                <td className={`py-2 text-right font-medium ${projectionOver ? "text-red-600" : "text-emerald-600"}`}>
                  {currency.format(projection)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

