import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { HouseholdSplitMode, HouseholdSplitResponse } from "../api/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function Repartition() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<HouseholdSplitMode>("PROPORTIONNEL");
  const [data, setData] = useState<HouseholdSplitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<HouseholdSplitResponse>(
        `/api/household-split?year=${year}&month=${month}&mode=${mode}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger la répartition.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, mode]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between card p-3">
        <button onClick={() => shiftMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          ← Précédent
        </button>
        <span className="text-lg font-semibold">
          Répartition des charges — {MONTH_LABELS[month - 1]} {year}
        </span>
        <button onClick={() => shiftMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          Suivant →
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card">
        <p className="text-sm text-slate-500">
          Répartit le total des dépenses sur vos comptes joints entre les membres du foyer, au prorata de leurs
          revenus du mois ou à parts égales. Le revenu total de chaque membre est utilisé pour ce calcul, même si
          le détail des comptes n'est pas partagé.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMode("PROPORTIONNEL")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "PROPORTIONNEL" ? "bg-pink-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            Proportionnel aux revenus
          </button>
          <button
            onClick={() => setMode("EGAL")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "EGAL" ? "bg-pink-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            Parts égales
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : data.members.length === 0 ? (
        <p className="text-sm text-slate-500">Rejoins ou crée un foyer pour utiliser ce calcul.</p>
      ) : (
        <>
          <div className="card">
            <p className="text-xs text-slate-500">Total des charges communes (comptes joints)</p>
            <p className="mt-1 text-2xl font-semibold">{currency.format(data.jointExpensesTotal)}</p>
            {data.fallbackToEqual && (
              <p className="mt-1 text-xs text-slate-400">
                Aucun revenu déclaré ce mois-ci : répartition à parts égales appliquée par défaut.
              </p>
            )}
          </div>

          <section className="card">
            <h2 className="font-semibold">Part de chacun</h2>
            <ul className="mt-2">
              {data.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                  <span className="text-sm">
                    {m.firstName} {m.isYou && <span className="text-slate-400">(toi)</span>}
                    {mode === "PROPORTIONNEL" && !data.fallbackToEqual && (
                      <span className="text-slate-400"> — revenus {currency.format(m.income)}</span>
                    )}
                  </span>
                  <span className="text-sm font-medium">
                    {currency.format(m.amountDue)} <span className="text-slate-400">({Math.round(m.share * 100)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
