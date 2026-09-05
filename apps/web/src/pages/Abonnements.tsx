import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconRepeat } from "../components/icons";
import type { Subscription, SubscriptionsResponse, SubscriptionStatus, UsageFrequency } from "../api/types";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  NON_EVALUE: "Non évalué",
  A_GARDER: "À garder",
  A_SURVEILLER: "À surveiller",
  A_RESILIER: "À résilier",
};

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  NON_EVALUE: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  A_GARDER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  A_SURVEILLER: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  A_RESILIER: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const USAGE_LABELS: Record<UsageFrequency, string> = {
  QUOTIDIEN: "Quotidien",
  HEBDOMADAIRE: "Hebdomadaire",
  MENSUEL: "Mensuel",
  RARE: "Rare",
  JAMAIS: "Jamais",
};

export function Abonnements() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<SubscriptionsResponse>("/api/subscriptions");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les abonnements.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    await apiFetch(`/api/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  }

  async function handleDismiss(id: string) {
    if (!confirm("Retirer cet élément de la liste des abonnements détectés ?")) return;
    await apiFetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    await load();
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconRepeat className="h-6 w-6 text-violet-600" />
          Audit des abonnements
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Détectés automatiquement à partir des dépenses qui reviennent sur au moins deux mois avec un montant
          stable, sur les 12 derniers mois.
        </p>
      </div>

      <section className="card">
        <p className="text-xs text-slate-500">Coût annualisé total des abonnements détectés</p>
        <p className="mt-1 text-2xl font-semibold">{currency.format(data.annualTotal)}</p>
      </section>

      {data.subscriptions.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun abonnement détecté pour l'instant. Reviens ici après avoir saisi tes dépenses sur quelques mois.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.subscriptions.map((sub) => (
            <SubscriptionCard key={sub.id} sub={sub} onUpdate={handleUpdate} onDismiss={handleDismiss} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubscriptionCard({
  sub,
  onUpdate,
  onDismiss,
}: {
  sub: Subscription;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}) {
  const currency = useCurrencyFormatter();
  const [lastUsed, setLastUsed] = useState(sub.lastUsedAt ? sub.lastUsedAt.slice(0, 10) : "");
  const [reminder, setReminder] = useState(sub.cancelReminderAt ? sub.cancelReminderAt.slice(0, 10) : "");

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{sub.poste}</p>
          <p className="text-xs text-slate-500">
            {currency.format(Number(sub.amount))} / mois · {currency.format(sub.annualCost)} / an · vu{" "}
            {sub.occurrences} mois, dernière fois en {MONTH_NAMES[sub.lastSeen.month - 1]} {sub.lastSeen.year}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
          {STATUS_LABELS[sub.status]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Statut</label>
          <select
            value={sub.status}
            onChange={(e) => onUpdate(sub.id, { status: e.target.value })}
            className="w-full input px-2 py-1.5 text-sm"
          >
            {(Object.entries(STATUS_LABELS) as [SubscriptionStatus, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Fréquence d'usage</label>
          <select
            value={sub.usageFrequency ?? ""}
            onChange={(e) => onUpdate(sub.id, { usageFrequency: e.target.value || null })}
            className="w-full input px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {(Object.entries(USAGE_LABELS) as [UsageFrequency, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Dernière utilisation</label>
          <input
            type="date"
            value={lastUsed}
            onChange={(e) => {
              setLastUsed(e.target.value);
              onUpdate(sub.id, { lastUsedAt: e.target.value ? new Date(e.target.value).toISOString() : null });
            }}
            className="w-full input px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Rappel de résiliation</label>
          <input
            type="date"
            value={reminder}
            onChange={(e) => {
              setReminder(e.target.value);
              onUpdate(sub.id, { cancelReminderAt: e.target.value ? new Date(e.target.value).toISOString() : null });
            }}
            className="w-full input px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <button onClick={() => onDismiss(sub.id)} className="mt-3 text-xs text-slate-400 hover:text-red-600">
        Ce n'est pas un abonnement
      </button>
    </li>
  );
}
