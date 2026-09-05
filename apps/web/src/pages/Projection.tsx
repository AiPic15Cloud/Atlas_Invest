import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconChartLine } from "../components/icons";
import type { DashboardResponse } from "../api/types";

const MONTH_OPTIONS = [6, 12, 24, 36];

interface ExtraCharge {
  id: string;
  label: string;
  amount: number;
}

export function Projection() {
  const currency = useCurrencyFormatter();
  const now = new Date();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [baseIncome, setBaseIncome] = useState("");
  const [baseExpense, setBaseExpense] = useState("");
  const [incomeChange, setIncomeChange] = useState("0");
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [monthsToProject, setMonthsToProject] = useState(12);

  useEffect(() => {
    apiFetch<DashboardResponse>(`/api/dashboard?year=${now.getFullYear()}`)
      .then((res) => {
        setDashboard(res);
        setBaseIncome(res.averages.incomePerMonth.toFixed(2));
        setBaseExpense(res.averages.expensePerMonth.toFixed(2));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les données."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAddCharge() {
    const amount = Number(newAmount.replace(",", "."));
    if (!newLabel.trim() || !Number.isFinite(amount) || amount === 0) return;
    setExtraCharges((prev) => [...prev, { id: crypto.randomUUID(), label: newLabel.trim(), amount }]);
    setNewLabel("");
    setNewAmount("");
  }

  function handleRemoveCharge(id: string) {
    setExtraCharges((prev) => prev.filter((c) => c.id !== id));
  }

  const simulation = useMemo(() => {
    const income = Number(baseIncome.replace(",", ".")) || 0;
    const expense = Number(baseExpense.replace(",", ".")) || 0;
    const change = Number(incomeChange.replace(",", ".")) || 0;
    const extraTotal = extraCharges.reduce((sum, c) => sum + c.amount, 0);

    const simulatedIncome = income + change;
    const simulatedExpense = expense + extraTotal;
    const monthlyReste = simulatedIncome - simulatedExpense;

    const rows = Array.from({ length: monthsToProject }, (_, i) => ({
      month: i + 1,
      reste: monthlyReste,
      cumulative: monthlyReste * (i + 1),
    }));

    return { simulatedIncome, simulatedExpense, monthlyReste, rows, extraTotal };
  }, [baseIncome, baseExpense, incomeChange, extraCharges, monthsToProject]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!dashboard) return <p className="text-sm text-slate-500">Chargement...</p>;

  const finalBalance = simulation.rows[simulation.rows.length - 1]?.cumulative ?? 0;
  const firstNegativeMonth = simulation.rows.find((r) => r.cumulative < 0)?.month ?? null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card p-3">
        <span className="text-lg font-semibold flex items-center gap-2">
          <IconChartLine className="h-5 w-5 text-violet-600" />
          Projection et simulation
        </span>
        <p className="mt-1 text-sm text-slate-500">
          Simule l'impact d'un changement de revenu ou d'une nouvelle dépense récurrente sur ton budget des
          prochains mois. Point de départ : ta moyenne mensuelle {now.getFullYear()}, modifiable ci-dessous.
        </p>
      </div>

      <section className="card">
        <h2 className="font-semibold">Hypothèses</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">Revenu mensuel de départ</span>
            <input
              className="mt-1 w-full input"
              value={baseIncome}
              onChange={(e) => setBaseIncome(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Dépenses mensuelles de départ</span>
            <input
              className="mt-1 w-full input"
              value={baseExpense}
              onChange={(e) => setBaseExpense(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Changement de revenu simulé (+/-)</span>
            <input
              className="mt-1 w-full input"
              value={incomeChange}
              onChange={(e) => setIncomeChange(e.target.value)}
              placeholder="Ex. +200 ou -500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Mois à projeter</span>
            <select
              className="mt-1 w-full input"
              value={monthsToProject}
              onChange={(e) => setMonthsToProject(Number(e.target.value))}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} mois
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="text-xs text-slate-500">Nouvelles dépenses récurrentes simulées (+) ou économies (-)</span>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <input
              className="input sm:min-w-[160px] sm:flex-1"
              placeholder="Libellé (ex. Crédit voiture)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <input
              className="input sm:w-32"
              placeholder="Montant"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
            <button
              onClick={handleAddCharge}
              className="btn btn-secondary"
            >
              Ajouter
            </button>
          </div>
          {extraCharges.length > 0 && (
            <ul className="mt-2">
              {extraCharges.map((c) => (
                <li key={c.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-1 text-sm last:border-0">
                  <span>{c.label}</span>
                  <span className="flex items-center gap-2">
                    {currency.format(c.amount)}
                    <button onClick={() => handleRemoveCharge(c.id)} className="text-xs text-red-500 underline">
                      Retirer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold">Résultat de la simulation</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Revenu simulé</p>
            <p className="text-lg font-medium">{currency.format(simulation.simulatedIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dépenses simulées</p>
            <p className="text-lg font-medium">{currency.format(simulation.simulatedExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Reste à vivre simulé / mois</p>
            <p className={`text-lg font-medium ${simulation.monthlyReste < 0 ? "text-red-600" : ""}`}>
              {currency.format(simulation.monthlyReste)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {simulation.monthlyReste >= 0
            ? `À ce rythme, tu accumulerais environ ${currency.format(finalBalance)} d'ici ${monthsToProject} mois.`
            : firstNegativeMonth !== null
              ? `Attention : à ce rythme, ton solde cumulé passerait sous zéro dès le mois ${firstNegativeMonth}.`
              : `À ce rythme, ton solde cumulé se dégraderait de ${currency.format(Math.abs(finalBalance))} sur ${monthsToProject} mois.`}
        </p>

        <div className="mt-4 max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500">
                <th className="py-1">Mois</th>
                <th className="py-1">Reste à vivre</th>
                <th className="py-1">Solde cumulé</th>
              </tr>
            </thead>
            <tbody>
              {simulation.rows.map((row) => (
                <tr key={row.month} className="border-b border-slate-50">
                  <td className="py-1">Mois {row.month}</td>
                  <td className="py-1">{currency.format(row.reste)}</td>
                  <td className={`py-1 font-medium ${row.cumulative < 0 ? "text-red-600" : ""}`}>
                    {currency.format(row.cumulative)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
