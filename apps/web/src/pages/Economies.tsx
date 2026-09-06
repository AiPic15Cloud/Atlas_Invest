import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconScissors } from "../components/icons";
import type { EmergencyFundProfile, SavingsOpportunities } from "../api/types";

export function Economies() {
  const currency = useCurrencyFormatter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<SavingsOpportunities | null>(null);
  const [profile, setProfile] = useState<EmergencyFundProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reallocating, setReallocating] = useState(false);
  const [reallocated, setReallocated] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<SavingsOpportunities>(`/api/savings-opportunities?year=${year}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les recommandations.");
    }
  }

  useEffect(() => {
    load();
    setReallocated(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    apiFetch<{ profile: EmergencyFundProfile | null }>("/api/emergency-fund").then((res) => setProfile(res.profile));
  }, []);

  async function handleReallocate() {
    if (!data || !profile) return;
    setReallocating(true);
    setError(null);
    try {
      const newCapacity = profile.monthlySavingsCapacity + data.totalMonthlyEquivalent;
      const res = await apiFetch<{ profile: EmergencyFundProfile }>("/api/emergency-fund/progress", {
        method: "PATCH",
        body: JSON.stringify({ monthlySavingsCapacityOverride: Math.round(newCapacity * 100) / 100 }),
      });
      setProfile(res.profile);
      setReallocated(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setReallocating(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  const hasOverlapRisk = data.regret.byPoste.length > 0 && data.subscriptionsToCancel.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <IconScissors className="h-6 w-6 text-violet-600" />
        Recommandations d'économies
      </h1>

      <div className="flex items-center justify-between card p-3">
        <button onClick={() => setYear((y) => y - 1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          ← {year - 1}
        </button>
        <span className="font-medium">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          {year + 1} →
        </button>
      </div>

      <section className="card">
        <p className="text-xs text-slate-500">Total identifié sur l'année</p>
        <p className="mt-1 text-2xl font-semibold">{currency.format(data.totalAnnual)}</p>
        <p className="mt-1 text-sm text-slate-500">
          Soit environ {currency.format(data.totalMonthlyEquivalent)} / mois si tu agis sur ces postes.
        </p>
        {hasOverlapRisk && (
          <p className="mt-2 text-xs text-slate-400">
            Un abonnement également marqué comme dépense regrettée peut être compté dans les deux catégories
            ci-dessous ; le total peut donc être légèrement surestimé.
          </p>
        )}

        {profile === undefined ? null : profile ? (
          <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            {reallocated ? (
              <p className="text-sm text-emerald-700">
                Capacité d'épargne mensuelle mise à jour : {currency.format(profile.monthlySavingsCapacity)}.{" "}
                <Link to="/epargne" className="underline">
                  Voir mon épargne de précaution
                </Link>
              </p>
            ) : (
              <button
                onClick={handleReallocate}
                disabled={reallocating || data.totalMonthlyEquivalent === 0}
                className="btn btn-primary"
              >
                {reallocating
                  ? "..."
                  : `Transformer ces économies en épargne (+${currency.format(data.totalMonthlyEquivalent)}/mois)`}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm text-slate-500">
            <Link to="/epargne" className="underline">
              Complète ton épargne de précaution
            </Link>{" "}
            pour pouvoir réallouer ces économies vers ta capacité d'épargne mensuelle.
          </p>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Dépenses regrettées</h2>
          <span className="text-sm font-semibold">{currency.format(data.regret.total)}</span>
        </div>
        {data.regret.byPoste.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune dépense regrettée identifiée pour cette année.</p>
        ) : (
          <ul className="mt-2">
            {data.regret.byPoste.map((item) => (
              <li key={item.poste} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
                <span className="text-sm">
                  {item.poste} <span className="text-slate-400">({item.count} fois)</span>
                </span>
                <span className="text-sm font-medium">{currency.format(item.total)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/budget-du-mois" className="mt-3 inline-block text-sm link">
          Revoir ces dépenses
        </Link>
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Abonnements à résilier</h2>
          <span className="text-sm font-semibold">{currency.format(data.subscriptionsAnnualTotal)} / an</span>
        </div>
        {data.subscriptionsToCancel.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucun abonnement marqué « à résilier » pour l'instant.
          </p>
        ) : (
          <ul className="mt-2">
            {data.subscriptionsToCancel.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
                <span className="text-sm">
                  En résiliant <span className="font-medium">{sub.poste}</span>, tu économises
                </span>
                <span className="text-sm font-medium">{currency.format(sub.annualCost)} / an</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/abonnements" className="mt-3 inline-block text-sm link">
          Voir mes abonnements
        </Link>
      </section>
    </div>
  );
}
