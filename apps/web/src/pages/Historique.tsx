import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { CorrectionHistoryResponse, CorrectionLogEntry, CorrectionType } from "../api/types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const TYPE_LABELS: Record<CorrectionType, string> = {
  WASTEFUL_EXPENSE: "Dépense inutile",
  SUBSCRIPTION_STATUS: "Abonnement",
};

const TYPE_COLORS: Record<CorrectionType, string> = {
  WASTEFUL_EXPENSE: "bg-amber-100 text-amber-800",
  SUBSCRIPTION_STATUS: "bg-sky-100 text-sky-800",
};

export function Historique() {
  const [logs, setLogs] = useState<CorrectionLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CorrectionType | "ALL">("ALL");

  useEffect(() => {
    apiFetch<CorrectionHistoryResponse>("/api/correction-history")
      .then((res) => setLogs(res.logs))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger l'historique."));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!logs) return <p className="text-sm text-slate-500">Chargement...</p>;

  const filtered = filter === "ALL" ? logs : logs.filter((l) => l.type === filter);

  return (
    <div className="space-y-6">
      <div className="card p-3">
        <span className="text-lg font-semibold">Historique des corrections</span>
        <p className="mt-1 text-sm text-slate-500">
          Journal de tes corrections manuelles (dépenses marquées utiles/inutiles, statuts d'abonnements changés),
          pour garder une trace de ce qui a été ajusté et quand.
        </p>
      </div>

      <div className="flex gap-2">
        {(["ALL", "WASTEFUL_EXPENSE", "SUBSCRIPTION_STATUS"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              filter === t ? "bg-pink-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {t === "ALL" ? "Tout" : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune correction enregistrée pour l'instant.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((log) => (
            <li key={log.id} className="card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[log.type]}`}>
                    {TYPE_LABELS[log.type]}
                  </span>
                  <span className="text-sm">{log.label}</span>
                  {log.detail && <p className="mt-1 text-xs text-slate-400">{log.detail}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{dateFormat.format(new Date(log.createdAt))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
