import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconUsers } from "../components/icons";
import type { HouseholdSplitMode, HouseholdSplitResponse } from "../api/types";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MODE_LABELS: Record<HouseholdSplitMode, string> = {
  PRORATA_REVENUS: "Prorata des revenus",
  PARTS_EGALES: "Parts égales",
  RESTE_EGAL: "À reste égal",
  POURCENTAGE_CHOISI: "% au choix",
  FORFAIT_FIXE: "Forfait fixe",
  POT_COMMUN_POURCENTAGE: "Pot commun en %",
  A_LA_CARTE: "À la carte",
};

const MODE_EXPLAINERS: Record<HouseholdSplitMode, { avantage: string; angleMort: string; pourQui: string }> = {
  PRORATA_REVENUS: {
    avantage: "Équitable : chacun·e contribue en proportion de son revenu, l'effort pèse pareil sur les deux budgets.",
    angleMort: "Il faut accepter de partager le montant de ses revenus, pas toujours évident.",
    pourQui: "Les couples avec un écart de revenus qui veulent un partage juste.",
  },
  PARTS_EGALES: {
    avantage: "Simple et symétrique : chacun·e paie exactement la même somme.",
    angleMort: "Peut peser plus lourd sur la personne qui gagne le moins.",
    pourQui: "Les couples aux revenus proches, ou qui préfèrent la simplicité.",
  },
  RESTE_EGAL: {
    avantage: "Une fois les charges communes payées, il reste exactement la même somme à chacun·e pour vivre.",
    angleMort: "La personne qui gagne le plus paie une part plus importante des charges.",
    pourQui: "Les couples qui veulent égaliser le confort de vie plutôt que l'effort financier.",
  },
  POURCENTAGE_CHOISI: {
    avantage: "Vous décidez vous-mêmes de la clé de répartition, sur mesure.",
    angleMort: "Demande de se mettre d'accord, et de la mettre à jour si la situation change.",
    pourQui: "Les couples avec un accord spécifique (ex. l'un paie plus pour telle raison).",
  },
  FORFAIT_FIXE: {
    avantage: "Prévisible : chacun·e sait à l'avance combien il ou elle verse chaque mois.",
    angleMort: "Ne s'ajuste pas automatiquement si le montant des charges communes varie.",
    pourQui: "Les couples qui préfèrent un montant fixe, façon pot commun.",
  },
  POT_COMMUN_POURCENTAGE: {
    avantage: "Chacun·e verse un % de son propre revenu dans un pot commun qui paie les charges.",
    angleMort: "Le pot peut ne pas couvrir exactement les charges : un écart (manque ou surplus) peut apparaître.",
    pourQui: "Les couples qui pensent en % de revenu plutôt qu'en montant précis des charges.",
  },
  A_LA_CARTE: {
    avantage: "Chaque dépense commune est attribuée à qui l'a vraiment engagée, au cas par cas.",
    angleMort: "Demande d'attribuer chaque dépense manuellement ; celles non attribuées sont réparties au prorata.",
    pourQui: "Les couples qui préfèrent suivre précisément qui paie quoi.",
  },
};

export function Repartition() {
  const currency = useCurrencyFormatter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<HouseholdSplitMode | null>(null);
  const [data, setData] = useState<HouseholdSplitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function load(previewMode?: HouseholdSplitMode) {
    try {
      const query = `year=${year}&month=${month}${previewMode ? `&mode=${previewMode}` : ""}`;
      const res = await apiFetch<HouseholdSplitResponse>(`/api/household-split?${query}`);
      setData(res);
      setMode(res.mode);
      setCustomInputs(Object.fromEntries(res.members.map((m) => [m.userId, m.customValue !== null ? String(m.customValue) : ""])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger la répartition.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  async function handleSelectMode(newMode: HouseholdSplitMode) {
    setMode(newMode);
    setSaveMessage(null);
    await load(newMode);
  }

  async function handleSave() {
    if (!mode || !data) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const needsCustom = mode === "POURCENTAGE_CHOISI" || mode === "FORFAIT_FIXE" || mode === "POT_COMMUN_POURCENTAGE";
      const customShares = needsCustom
        ? Object.fromEntries(
            data.members
              .map((m) => [m.userId, Number((customInputs[m.userId] ?? "").replace(",", "."))])
              .filter(([, v]) => Number.isFinite(v as number) && (v as number) >= 0),
          )
        : undefined;
      await apiFetch("/api/household-split/settings", {
        method: "PATCH",
        body: JSON.stringify({ mode, customShares }),
      });
      setSaveMessage("Réglage enregistré pour ton foyer.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(expenseId: string, userId: string | null) {
    try {
      await apiFetch(`/api/household-split/assignments/${expenseId}`, {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      });
      await load(mode ?? undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;

  const needsCustomInputs = mode === "POURCENTAGE_CHOISI" || mode === "FORFAIT_FIXE" || mode === "POT_COMMUN_POURCENTAGE";

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <IconUsers className="h-6 w-6 text-violet-600" />
        Répartition des charges
      </h1>

      <div className="flex items-center justify-between card p-3">
        <button onClick={() => shiftMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          ← Précédent
        </button>
        <span className="font-medium">
          {MONTH_LABELS[month - 1]} {year}
        </span>
        <button onClick={() => shiftMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          Suivant →
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card">
        <p className="text-sm text-slate-500">
          Comment vous répartissez les charges communes (dépenses sur vos comptes joints) entre les membres du foyer.
          Choisis la méthode qui vous correspond le mieux.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(MODE_LABELS) as HouseholdSplitMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleSelectMode(m)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === m ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {mode && (
        <div className="card grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-600">Avantage</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">{MODE_EXPLAINERS[mode].avantage}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-amber-600">Angle mort</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">{MODE_EXPLAINERS[mode].angleMort}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-pink-600">Pour qui</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">{MODE_EXPLAINERS[mode].pourQui}</p>
          </div>
        </div>
      )}

      {!data ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : data.members.length === 0 ? (
        <p className="text-sm text-slate-500">Rejoins ou crée un foyer pour utiliser ce calcul.</p>
      ) : (
        <>
          <div className="card">
            <p className="text-xs text-slate-500">Total des charges communes (comptes joints)</p>
            <p className="mt-1 text-2xl font-semibold">{currency.format(data.jointExpensesTotal)}</p>
            {data.note && <p className="mt-1 text-xs text-amber-600">{data.note}</p>}
          </div>

          {mode === "A_LA_CARTE" && (
            <section className="card">
              <h2 className="font-semibold">Attribuer chaque dépense commune</h2>
              {(!data.expenses || data.expenses.length === 0) ? (
                <p className="mt-2 text-sm text-slate-500">Aucune dépense sur un compte joint ce mois-ci.</p>
              ) : (
                <ul className="mt-2">
                  {data.expenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
                      <span className="text-sm">{e.poste}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{currency.format(e.amount)}</span>
                        <select
                          value={e.assignedToUserId ?? ""}
                          onChange={(ev) => handleAssign(e.id, ev.target.value || null)}
                          className="input px-2 py-1 text-sm"
                        >
                          <option value="">Non attribué</option>
                          {data.members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.firstName}{m.isYou ? " (toi)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {needsCustomInputs && (
            <section className="card">
              <h2 className="font-semibold">
                {mode === "POURCENTAGE_CHOISI"
                  ? "Pourcentage de chacun·e"
                  : mode === "POT_COMMUN_POURCENTAGE"
                    ? "% du revenu versé au pot commun"
                    : "Montant fixe de chacun·e"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {data.members.map((m) => (
                  <label key={m.userId} className="block">
                    <span className="text-xs text-slate-500">
                      {m.firstName} {m.isYou && "(toi)"}
                    </span>
                    <input
                      className="mt-1 w-32 input"
                      inputMode="decimal"
                      placeholder={mode === "FORFAIT_FIXE" ? "€" : "%"}
                      value={customInputs[m.userId] ?? ""}
                      onChange={(e) => setCustomInputs((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving} className="mt-3 btn btn-primary">
                {saving ? "..." : "Enregistrer"}
              </button>
              {saveMessage && <p className="mt-2 text-xs text-emerald-600">{saveMessage}</p>}
            </section>
          )}
          {!needsCustomInputs && (
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="btn btn-secondary">
                {saving ? "..." : "Utiliser ce mode par défaut pour le foyer"}
              </button>
              {saveMessage && <p className="text-xs text-emerald-600">{saveMessage}</p>}
            </div>
          )}

          <section className="card">
            <h2 className="font-semibold">Part de chacun·e</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.members.map((m) => (
                <div key={m.userId} className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                  <p className="font-medium">
                    {m.firstName} {m.isYou && <span className="text-slate-400">(toi)</span>}
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {currency.format(m.amountDue)}
                    <span className="ml-1 text-sm font-normal text-slate-400">/mois</span>
                  </p>
                  <p className="text-xs text-slate-500">{Math.round(m.share * 100)}% des dépenses</p>
                  <p className="mt-1 text-xs text-slate-500">
                    reste à vivre : <span className={m.resteAVivre < 0 ? "font-medium text-red-600" : "font-medium"}>{currency.format(m.resteAVivre)}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {data.members.length === 2 && (
            <section className="card">
              <h2 className="font-semibold">Ce que ça donne pour vous deux</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {data.members[0].firstName} verse {currency.format(data.members[0].amountDue)}
                {data.totalIncome > 0 && ` (soit ${Math.round((data.members[0].amountDue / Math.max(data.members[0].income, 1)) * 100)}% de son revenu)`}
                , {data.members[1].firstName} verse {currency.format(data.members[1].amountDue)}
                {data.totalIncome > 0 && ` (soit ${Math.round((data.members[1].amountDue / Math.max(data.members[1].income, 1)) * 100)}% du sien)`}.
                Une fois les charges communes payées, il reste{" "}
                {currency.format(data.members[0].resteAVivre)} à {data.members[0].firstName} et{" "}
                {currency.format(data.members[1].resteAVivre)} à {data.members[1].firstName}, à dépenser ou épargner librement.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
