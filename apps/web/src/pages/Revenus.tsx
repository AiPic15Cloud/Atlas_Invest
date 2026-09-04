import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { IncomeForm } from "../components/IncomeForm";
import type { BankAccountsResponse, Income, IncomeSummary } from "../api/types";

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

function shiftMonth(year: number, month: number, delta: number) {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export function Revenus() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [incomes, setIncomes] = useState<Income[] | null>(null);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [showYear, setShowYear] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMonth() {
    try {
      const res = await apiFetch<{ incomes: Income[] }>(`/api/incomes?year=${year}&month=${month}`);
      setIncomes(res.incomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les revenus.");
    }
  }

  async function loadSummary() {
    const res = await apiFetch<IncomeSummary>(`/api/incomes/summary?year=${year}`);
    setSummary(res);
  }

  async function loadAccounts() {
    const res = await apiFetch<BankAccountsResponse>("/api/bank-accounts");
    setAccounts(res);
  }

  useEffect(() => {
    loadMonth();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const total = useMemo(() => (incomes ?? []).reduce((sum, i) => sum + Number(i.amount), 0), [incomes]);
  const availableAccounts = useMemo(
    () => [...(accounts?.mine ?? []), ...(accounts?.joint ?? [])],
    [accounts],
  );

  function goToMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  async function handleAdd(data: { source: string; amount: number; bankAccountId: string }) {
    await apiFetch("/api/incomes", { method: "POST", body: JSON.stringify({ ...data, year, month }) });
    setAdding(false);
    await Promise.all([loadMonth(), loadSummary()]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce revenu ?")) return;
    await apiFetch(`/api/incomes/${id}`, { method: "DELETE" });
    await Promise.all([loadMonth(), loadSummary()]);
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Revenus</h1>
        <button onClick={() => setShowYear((v) => !v)} className="text-sm link">
          {showYear ? "Voir le mois" : "Voir l'année"}
        </button>
      </div>

      {showYear ? (
        <YearView year={year} summary={summary} onSelectMonth={(m) => { setMonth(m); setShowYear(false); }} />
      ) : (
        <>
          <div className="flex items-center justify-between card p-3">
            <button onClick={() => goToMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
              ← Précédent
            </button>
            <span className="font-medium">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => goToMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
              Suivant →
            </button>
          </div>

          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Sources du mois — total {currency.format(total)}
              </h2>
              <div className="flex gap-3">
                {!copyOpen && (
                  <button onClick={() => setCopyOpen(true)} className="text-sm link">
                    Copier un mois
                  </button>
                )}
                {!adding && (
                  <button onClick={() => setAdding(true)} className="text-sm link">
                    + Ajouter un revenu
                  </button>
                )}
              </div>
            </div>

            {copyOpen && (
              <CopyMonthPanel
                targetYear={year}
                targetMonth={month}
                onCancel={() => setCopyOpen(false)}
                onDone={async () => {
                  setCopyOpen(false);
                  await Promise.all([loadMonth(), loadSummary()]);
                }}
              />
            )}

            {!incomes ? (
              <p className="mt-2 text-sm text-slate-500">Chargement...</p>
            ) : incomes.length === 0 && !adding ? (
              <p className="mt-2 text-sm text-slate-500">Aucun revenu saisi pour ce mois.</p>
            ) : (
              <ul className="mt-2">
                {incomes.map((income) => (
                  <li
                    key={income.id}
                    className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{income.source}</p>
                      <p className="text-xs text-slate-500">
                        {income.bankAccountName} · {total > 0 ? percent.format(Number(income.amount) / total) : "—"}{" "}
                        du mois
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{currency.format(Number(income.amount))}</span>
                      <button
                        onClick={() => handleDelete(income.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {adding && (
              <IncomeForm accounts={availableAccounts} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
            )}
            {adding && availableAccounts.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Ajoute d'abord un compte bancaire dans l'onglet "Comptes" pour pouvoir saisir un revenu.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function YearView({
  year,
  summary,
  onSelectMonth,
}: {
  year: number;
  summary: IncomeSummary | null;
  onSelectMonth: (month: number) => void;
}) {
  const total = summary?.totalsByMonth.reduce((a, b) => a + b, 0) ?? 0;
  return (
    <section className="card">
      <h2 className="font-semibold">
        Revenus {year} — total {currency.format(total)}
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {MONTH_NAMES.map((name, index) => (
          <li key={name} className="flex items-center justify-between py-2">
            <button
              onClick={() => onSelectMonth(index + 1)}
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              {name}
            </button>
            <span className="text-sm font-semibold">
              {currency.format(summary?.totalsByMonth[index] ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CopyMonthPanel({
  targetYear,
  targetMonth,
  onCancel,
  onDone,
}: {
  targetYear: number;
  targetMonth: number;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const prev = shiftMonth(targetYear, targetMonth, -1);
  const [fromYear, setFromYear] = useState(prev.year);
  const [fromMonth, setFromMonth] = useState(prev.month);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/incomes/copy-month", {
        method: "POST",
        body: JSON.stringify({ fromYear, fromMonth, toYear: targetYear, toMonth: targetMonth }),
      });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-600">
        Copier la structure de revenus d'un autre mois vers {MONTH_NAMES[targetMonth - 1]} {targetYear}. Cela
        remplacera les revenus déjà saisis pour ce mois.
      </p>
      <div className="flex gap-2">
        <select
          value={fromMonth}
          onChange={(e) => setFromMonth(Number(e.target.value))}
          className="input px-2 py-1.5 text-sm"
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={fromYear}
          onChange={(e) => setFromYear(Number(e.target.value))}
          className="w-24 input px-2 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Copie..." : "Copier"}
        </button>
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
          Annuler
        </button>
      </div>
    </div>
  );
}
