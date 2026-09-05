import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { EmergencyFundQuestionnaire } from "../components/EmergencyFundQuestionnaire";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconShield } from "../components/icons";
import type { CriterionValue, EmergencyFundProfile } from "../api/types";

function vulnerabilityLabel(score: number): string {
  if (score >= 4.5) return "Très stable";
  if (score >= 3.5) return "Stable";
  if (score >= 2.5) return "Modérée";
  if (score >= 1.5) return "Vulnérable";
  return "Très vulnérable";
}

export function EpargnePrecaution() {
  const currency = useCurrencyFormatter();
  const [profile, setProfile] = useState<EmergencyFundProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [retaking, setRetaking] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<{ profile: EmergencyFundProfile | null }>("/api/emergency-fund");
      setProfile(res.profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'épargne de précaution.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleQuestionnaireSubmit(answers: Record<string, CriterionValue>) {
    await apiFetch("/api/emergency-fund", { method: "PUT", body: JSON.stringify(answers) });
    setRetaking(false);
    await load();
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (profile === undefined) return <p className="text-sm text-slate-500">Chargement...</p>;

  if (!profile || retaking) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconShield className="h-6 w-6 text-violet-600" />
          Épargne de précaution
        </h1>
        <EmergencyFundQuestionnaire
          initialAnswers={profile?.answers}
          onSubmit={handleQuestionnaireSubmit}
          onCancel={profile ? () => setRetaking(false) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconShield className="h-6 w-6 text-violet-600" />
          Épargne de précaution
        </h1>
        <button onClick={() => setRetaking(true)} className="text-sm link">
          Refaire le questionnaire
        </button>
      </div>

      <ObjectiveSection profile={profile} onUpdated={setProfile} />
      <ScoreDetailSection profile={profile} onUpdated={setProfile} />
      <ProgressSection profile={profile} onUpdated={setProfile} />
      <EnvelopesSection profile={profile} onUpdated={setProfile} />
    </div>
  );
}

function ObjectiveSection({
  profile,
  onUpdated,
}: {
  profile: EmergencyFundProfile;
  onUpdated: (p: EmergencyFundProfile) => void;
}) {
  const currency = useCurrencyFormatter();
  const [editingMonths, setEditingMonths] = useState(false);
  const [monthsInput, setMonthsInput] = useState(String(profile.targetMonths));
  const [error, setError] = useState<string | null>(null);

  async function saveMonths() {
    const parsed = Number(monthsInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 36) {
      setError("Indique un nombre de mois entre 1 et 36.");
      return;
    }
    setError(null);
    try {
      const res = await apiFetch<{ profile: EmergencyFundProfile }>("/api/emergency-fund/progress", {
        method: "PATCH",
        body: JSON.stringify({ monthsOverride: parsed }),
      });
      onUpdated(res.profile);
      setEditingMonths(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function resetToRecommended() {
    const res = await apiFetch<{ profile: EmergencyFundProfile }>("/api/emergency-fund/progress", {
      method: "PATCH",
      body: JSON.stringify({ monthsOverride: null }),
    });
    onUpdated(res.profile);
    setMonthsInput(String(res.profile.targetMonths));
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Ton objectif</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Score de vulnérabilité : <span className="font-medium">{profile.score.toFixed(1)}/5</span> —{" "}
        {vulnerabilityLabel(profile.score)}. Objectif recommandé : {profile.recommendedMonths} mois de dépenses
        essentielles.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Nombre de mois visé</p>
          {editingMonths ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={monthsInput}
                onChange={(e) => setMonthsInput(e.target.value)}
                className="w-20 input px-2 py-1 text-sm"
              />
              <button onClick={saveMonths} className="rounded-md bg-violet-600 hover:bg-violet-700 px-2 py-1 text-xs font-medium text-white">
                Valider
              </button>
              <button onClick={() => setEditingMonths(false)} className="text-xs text-slate-500 underline">
                Annuler
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-lg font-semibold">{profile.targetMonths} mois</p>
              <button onClick={() => setEditingMonths(true)} className="text-xs text-slate-500 underline">
                Ajuster
              </button>
              {profile.monthsOverride !== null && (
                <button onClick={resetToRecommended} className="text-xs text-slate-500 underline">
                  Revenir à {profile.recommendedMonths}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Montant cible</p>
          <p className="mt-1 text-lg font-semibold">{currency.format(profile.targetAmount)}</p>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">
        Basé sur {currency.format(profile.essentialMonthlyExpense)} de dépenses essentielles par mois
        {profile.essentialMonthlyExpense === 0 &&
          " (renseigne ton budget type ou tes dépenses du mois pour affiner ce montant)"}
        .
      </p>
    </section>
  );
}

function ScoreDetailSection({
  profile,
  onUpdated,
}: {
  profile: EmergencyFundProfile;
  onUpdated: (p: EmergencyFundProfile) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(key: string, value: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ profile: EmergencyFundProfile }>(`/api/emergency-fund/criteria/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ value }),
      });
      onUpdated(res.profile);
      setEditingKey(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Le détail de ton score</h2>
        <button onClick={() => setExpanded((v) => !v)} className="text-sm link">
          {expanded ? "Réduire" : "Afficher"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profile.breakdown.map((crit) => (
            <div key={crit.key} className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{crit.question}</p>
                <button
                  onClick={() => setEditingKey(editingKey === crit.key ? null : crit.key)}
                  className="shrink-0 text-xs text-slate-400 hover:text-violet-600"
                  aria-label={`Modifier ${crit.question}`}
                >
                  ✎
                </button>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {crit.value}
                <span className="text-sm font-normal text-slate-400">/{crit.maxValue}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{crit.label}</p>

              {editingKey === crit.key && (
                <div className="mt-2 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                  {crit.options.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        checked={crit.value === opt.value}
                        disabled={busy}
                        onChange={() => handleChange(crit.key, opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProgressSection({
  profile,
  onUpdated,
}: {
  profile: EmergencyFundProfile;
  onUpdated: (p: EmergencyFundProfile) => void;
}) {
  const currency = useCurrencyFormatter();
  const [savedInput, setSavedInput] = useState(String(profile.currentSavedAmount));
  const [capacityInput, setCapacityInput] = useState(
    profile.monthlySavingsCapacityOverride !== null ? String(profile.monthlySavingsCapacityOverride) : "",
  );
  const [error, setError] = useState<string | null>(null);

  async function saveSaved() {
    const parsed = Number(savedInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Montant invalide.");
      return;
    }
    setError(null);
    const res = await apiFetch<{ profile: EmergencyFundProfile }>("/api/emergency-fund/progress", {
      method: "PATCH",
      body: JSON.stringify({ currentSavedAmount: parsed }),
    });
    onUpdated(res.profile);
  }

  async function saveCapacity() {
    const value = capacityInput.trim() === "" ? null : Number(capacityInput.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError("Montant invalide.");
      return;
    }
    setError(null);
    const res = await apiFetch<{ profile: EmergencyFundProfile }>("/api/emergency-fund/progress", {
      method: "PATCH",
      body: JSON.stringify({ monthlySavingsCapacityOverride: value }),
    });
    onUpdated(res.profile);
  }

  const pct = Math.round(profile.progressRatio * 100);

  return (
    <section className="card">
      <h2 className="font-semibold">Progression</h2>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>{currency.format(profile.currentSavedAmount)} épargnés</span>
          <span>{pct}% de l'objectif ({currency.format(profile.targetAmount)})</span>
        </div>
        <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div style={{ width: `${Math.min(pct, 100)}%` }} className="h-full bg-emerald-500" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="saved-amount" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Montant déjà épargné (€)
          </label>
          <div className="flex gap-1">
            <input
              id="saved-amount"
              value={savedInput}
              onChange={(e) => setSavedInput(e.target.value)}
              className="w-full input px-2 py-1.5 text-sm"
            />
            <button onClick={saveSaved} className="rounded-md bg-violet-600 hover:bg-violet-700 px-2 py-1.5 text-xs font-medium text-white">
              OK
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="capacity" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Capacité d'épargne mensuelle (€)
          </label>
          <div className="flex gap-1">
            <input
              id="capacity"
              value={capacityInput}
              onChange={(e) => setCapacityInput(e.target.value)}
              placeholder={String(profile.defaultMonthlySavingsCapacity)}
              className="w-full input px-2 py-1.5 text-sm"
            />
            <button onClick={saveCapacity} className="rounded-md bg-violet-600 hover:bg-violet-700 px-2 py-1.5 text-xs font-medium text-white">
              OK
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Par défaut : {currency.format(profile.defaultMonthlySavingsCapacity)} (issu du budget type)
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-300">Temps restant estimé</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {profile.monthsRemaining === null
              ? "Indéterminé"
              : profile.monthsRemaining <= 0
                ? "Objectif atteint"
                : `${Math.ceil(profile.monthsRemaining)} mois`}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}

function EnvelopesSection({
  profile,
  onUpdated,
}: {
  profile: EmergencyFundProfile;
  onUpdated: (p: EmergencyFundProfile) => void;
}) {
  const currency = useCurrencyFormatter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const parsed = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setError("Nom et montant valides requis.");
      return;
    }
    setError(null);
    const res = await apiFetch<{ profile: EmergencyFundProfile }>("/api/emergency-fund/envelopes", {
      method: "POST",
      body: JSON.stringify({ name, monthlyAllocation: parsed }),
    });
    onUpdated(res.profile);
    setName("");
    setAmount("");
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette enveloppe ?")) return;
    const res = await apiFetch<{ profile: EmergencyFundProfile }>(`/api/emergency-fund/envelopes/${id}`, {
      method: "DELETE",
    });
    onUpdated(res.profile);
  }

  const overAllocated = profile.envelopesTotal > profile.monthlySavingsCapacity;

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Répartir la capacité d'épargne mensuelle</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-sm link">
            + Ajouter une enveloppe
          </button>
        )}
      </div>
      <p className={`mt-1 text-xs ${overAllocated ? "text-red-600" : "text-slate-500"}`}>
        {currency.format(profile.envelopesTotal)} réparti(s) sur {currency.format(profile.monthlySavingsCapacity)} de
        capacité mensuelle{overAllocated && " — dépasse la capacité disponible"}
      </p>

      {profile.envelopes.length === 0 && !adding ? (
        <p className="mt-2 text-sm text-slate-500">Aucune enveloppe pour l'instant.</p>
      ) : (
        <ul className="mt-2">
          {profile.envelopes.map((env) => (
            <li key={env.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
              <span className="text-sm">{env.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{currency.format(env.monthlyAllocation)} / mois</span>
                <button onClick={() => handleDelete(env.id)} className="text-xs text-slate-400 hover:text-red-600">
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Livret A"
              className="w-36 input px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Montant / mois (€)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 input px-2 py-1 text-sm"
            />
          </div>
          <button onClick={handleAdd} className="rounded-md bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-medium text-white">
            Ajouter
          </button>
          <button onClick={() => setAdding(false)} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
            Annuler
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
