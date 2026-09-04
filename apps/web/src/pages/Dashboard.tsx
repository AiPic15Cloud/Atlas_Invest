import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { AnnualLineChart } from "../components/AnnualLineChart";
import type { DashboardResponse, EmergencyFundProfile } from "../api/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function defaultMonthIndex(year: number) {
  const now = new Date();
  return year === now.getFullYear() ? now.getMonth() : 11;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => defaultMonthIndex(new Date().getFullYear()));
  const [emergencyFund, setEmergencyFund] = useState<EmergencyFundProfile | null | undefined>(undefined);

  async function load() {
    try {
      const res = await apiFetch<DashboardResponse>(`/api/dashboard?year=${year}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le tableau de bord.");
    }
  }

  useEffect(() => {
    apiFetch<{ profile: EmergencyFundProfile | null }>("/api/emergency-fund").then((res) =>
      setEmergencyFund(res.profile),
    );
  }, []);

  useEffect(() => {
    load();
    setSelectedMonthIndex(defaultMonthIndex(year));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  const selected = data.monthly[selectedMonthIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <button onClick={() => setYear((y) => y - 1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          ← {year - 1}
        </button>
        <span className="text-lg font-semibold">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          {year + 1} →
        </button>
      </div>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-3 text-xl font-semibold">Vue d'ensemble {year}</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Revenu annuel net" value={currency.format(data.totals.income)} />
          <StatTile label="Dépenses sur l'année" value={currency.format(data.totals.expenses)} />
          <StatTile
            label="Reste"
            value={currency.format(data.totals.reste)}
            tone={data.totals.reste < 0 ? "warn" : "default"}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile label="Revenu moyen / mois" value={currency.format(data.averages.incomePerMonth)} muted />
          <StatTile label="Dépense moyenne / mois" value={currency.format(data.averages.expensePerMonth)} muted />
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 font-semibold">Revenu, dépenses et reste — {year}</h2>
        <AnnualLineChart monthly={data.monthly} selectedIndex={selectedMonthIndex} onSelectMonth={setSelectedMonthIndex} />

        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            <span className="font-medium">En {MONTH_NAMES[selectedMonthIndex]}</span> : revenu de{" "}
            {currency.format(selected.income)}, dépenses de {currency.format(selected.expense)}
            {selected.income > 0 && ` (${Math.round((selected.expense / selected.income) * 100)} % du revenu)`}, reste
            de {currency.format(selected.reste)}.
          </p>
          <button
            onClick={() => navigate(`/budget-du-mois?year=${year}&month=${selectedMonthIndex + 1}`)}
            className="mt-1 text-sm font-medium text-slate-900 underline"
          >
            Voir le détail de ce mois
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Méthode de budget active</h2>
          {data.budgetTemplate ? (
            <>
              <p className="mt-2 text-sm text-slate-700">{data.budgetTemplate.label}</p>
              <Link to="/budget-type" className="mt-2 inline-block text-sm font-medium text-slate-900 underline">
                Voir le budget type
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">Aucun budget type créé pour l'instant.</p>
              <Link to="/budget-type" className="mt-2 inline-block text-sm font-medium text-slate-900 underline">
                Créer mon budget type
              </Link>
            </>
          )}
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Épargne de précaution</h2>
          {emergencyFund === undefined ? (
            <p className="mt-2 text-sm text-slate-500">Chargement...</p>
          ) : emergencyFund ? (
            <>
              <p className="mt-2 text-sm text-slate-700">
                {currency.format(emergencyFund.currentSavedAmount)} sur {currency.format(emergencyFund.targetAmount)}{" "}
                ({Math.round(emergencyFund.progressRatio * 100)} %)
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  style={{ width: `${Math.min(emergencyFund.progressRatio * 100, 100)}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <Link to="/epargne" className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
                Voir le suivi
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Réponds au questionnaire de vulnérabilité pour estimer ton objectif d'épargne de précaution.
              </p>
              <Link to="/epargne" className="mt-2 inline-block text-sm font-medium text-slate-900 underline">
                Démarrer
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "default", muted = false }: { label: string; value: string; tone?: "default" | "warn"; muted?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${muted ? "bg-white ring-1 ring-slate-100" : "bg-slate-50"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "warn" ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
