import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconFlag } from "../components/icons";
import type { DashboardResponse, SavingsGoal, SavingsGoalsResponse, SurplusAllocationResponse } from "../api/types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

const GOAL_COLORS = ["violet", "sky", "amber", "rose", "emerald"] as const;
const GOAL_CHIP_CLASS: Record<(typeof GOAL_COLORS)[number], string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
};

export function Objectifs() {
  const currency = useCurrencyFormatter();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [contributionInputs, setContributionInputs] = useState<Record<string, string>>({});

  const [availableInput, setAvailableInput] = useState("");
  const [surplus, setSurplus] = useState<SurplusAllocationResponse | null>(null);
  const [surplusError, setSurplusError] = useState<string | null>(null);
  const [surplusLoading, setSurplusLoading] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<SavingsGoalsResponse>("/api/savings-goals");
      setGoals(res.goals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les objectifs.");
    }
  }

  useEffect(() => {
    load();
    // Pré-remplit avec l'argent réellement disponible du mois (voir Accueil),
    // que l'utilisateur peut ensuite ajuster avant de voir la proposition.
    apiFetch<DashboardResponse>(`/api/dashboard?year=${new Date().getFullYear()}`)
      .then((res) => {
        if (res.availableMoney.amount > 0) {
          setAvailableInput(String(Math.round(res.availableMoney.amount * 100) / 100));
        }
      })
      .catch(() => {});
  }, []);

  async function handleComputeSurplus() {
    const amount = Number(availableInput.replace(",", "."));
    if (!Number.isFinite(amount)) return;
    setSurplusLoading(true);
    setSurplusError(null);
    try {
      const res = await apiFetch<SurplusAllocationResponse>(
        `/api/savings-goals/surplus-allocation?available=${amount}`,
      );
      setSurplus(res);
    } catch (err) {
      setSurplusError(err instanceof ApiError ? err.message : "Impossible de calculer la proposition.");
    } finally {
      setSurplusLoading(false);
    }
  }

  async function handleAdd() {
    const parsedTarget = Number(targetAmount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(parsedTarget) || parsedTarget <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const parsedMonthly = monthlyContribution ? Number(monthlyContribution.replace(",", ".")) : null;
      await apiFetch("/api/savings-goals", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          targetAmount: parsedTarget,
          targetDate: targetDate ? new Date(`${targetDate}-01T00:00:00.000Z`).toISOString() : null,
          monthlyContribution: parsedMonthly && parsedMonthly > 0 ? parsedMonthly : null,
        }),
      });
      setName("");
      setTargetAmount("");
      setTargetDate("");
      setMonthlyContribution("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContribute(id: string) {
    const raw = contributionInputs[id];
    const amount = Number((raw ?? "").replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) return;
    try {
      await apiFetch(`/api/savings-goals/${id}/contribute`, { method: "POST", body: JSON.stringify({ amount }) });
      setContributionInputs((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet objectif ?")) return;
    try {
      await apiFetch(`/api/savings-goals/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  // Les objectifs sont déjà triés par priorité (puis par date de création)
  // par le backend : "monter"/"descendre" renormalise l'ordre affiché en
  // priorités 1..N puis échange les deux objectifs concernés (section 20).
  async function handleMove(id: string, direction: -1 | 1) {
    if (!goals) return;
    const index = goals.findIndex((g) => g.id === id);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= goals.length) return;

    const reordered = [...goals];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    const updates = reordered
      .map((g, i) => ({ id: g.id, newPriority: i + 1, changed: g.priority !== i + 1 }))
      .filter((u) => u.changed);

    try {
      await Promise.all(
        updates.map((u) =>
          apiFetch(`/api/savings-goals/${u.id}`, {
            method: "PATCH",
            body: JSON.stringify({ priority: u.newPriority }),
          }),
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  if (error && !goals) return <p className="text-sm text-red-600">{error}</p>;
  if (!goals) return <p className="text-sm text-slate-500">Chargement...</p>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card p-3">
        <span className="text-lg font-semibold flex items-center gap-2">
          <IconFlag className="h-5 w-5 text-violet-600" />
          Objectifs d'épargne
        </span>
        <p className="mt-1 text-sm text-slate-500">
          Donne un nom à tes projets (voyage, apport immobilier, mariage...) et suis leur progression, en plus de
          ton épargne de précaution.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="card">
        <h2 className="font-semibold">Créer un objectif</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="input"
            placeholder="Nom (ex. Voyage au Japon)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Montant cible"
            inputMode="decimal"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
          />
          <input
            className="input"
            type="month"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            title="Date cible (optionnel)"
          />
          <input
            className="input"
            placeholder="Épargne prévue / mois (optionnel)"
            inputMode="decimal"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={submitting}
          className="mt-3 btn btn-primary"
        >
          {submitting ? "..." : "Créer l'objectif"}
        </button>
      </section>

      {goals.length > 0 && goals.some((g) => !g.achieved) && (
        <section className="card">
          <h2 className="font-semibold">Que faire du surplus ce mois-ci ?</h2>
          <p className="mt-1 text-sm text-slate-500">
            Indique l'argent disponible à répartir : Atlas propose une répartition entre tes objectifs selon leur
            ordre de priorité — c'est une suggestion, aucun virement n'est effectué automatiquement.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="w-40 input"
              placeholder="Montant disponible"
              inputMode="decimal"
              value={availableInput}
              onChange={(e) => setAvailableInput(e.target.value)}
            />
            <button onClick={handleComputeSurplus} disabled={surplusLoading} className="btn btn-secondary">
              {surplusLoading ? "..." : "Voir la proposition"}
            </button>
          </div>
          {surplusError && <p className="mt-2 text-sm text-red-600">{surplusError}</p>}
          {surplus && (
            <div className="mt-3 space-y-1">
              {surplus.allocations.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune affectation possible avec ce montant.</p>
              ) : (
                <ul className="text-sm">
                  {surplus.allocations.map((line) => (
                    <li key={line.goalId} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                      <span>{line.goalName}</span>
                      <span className="font-medium">{currency.format(line.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {surplus.leftover > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Reste non affecté (tous les objectifs sont couverts) : {currency.format(surplus.leftover)}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun objectif pour l'instant.</p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal, index) => (
            <section key={goal.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleMove(goal.id, -1)}
                      disabled={index === 0}
                      className="text-xs leading-none text-slate-400 hover:text-violet-600 disabled:opacity-20"
                      aria-label={`Monter ${goal.name} en priorité`}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(goal.id, 1)}
                      disabled={index === goals.length - 1}
                      className="text-xs leading-none text-slate-400 hover:text-violet-600 disabled:opacity-20"
                      aria-label={`Descendre ${goal.name} en priorité`}
                    >
                      ▼
                    </button>
                  </div>
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${GOAL_CHIP_CLASS[GOAL_COLORS[index % GOAL_COLORS.length]]}`}
                  >
                    <IconFlag className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">
                    #{index + 1} {goal.name} {goal.achieved && <span className="text-emerald-600">✓ atteint</span>}
                  </h3>
                </div>
                <button onClick={() => handleDelete(goal.id)} className="text-xs text-red-500 underline">
                  Supprimer
                </button>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full ${goal.achieved ? "bg-emerald-500" : "bg-violet-600"}`}
                  style={{ width: `${Math.round(goal.progressRatio * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {currency.format(goal.currentAmount)} / {currency.format(goal.targetAmount)} (
                {Math.round(goal.progressRatio * 100)}%)
              </p>

              {goal.targetDate && (
                <p className="mt-1 text-xs text-slate-500">
                  Objectif visé pour {dateFormat.format(new Date(goal.targetDate))}
                  {goal.requiredMonthlyContribution !== null && !goal.achieved && (
                    <> — il faudrait épargner environ {currency.format(goal.requiredMonthlyContribution)} / mois.</>
                  )}
                </p>
              )}
              {goal.monthlyContribution !== null && goal.monthsRemaining !== null && !goal.achieved && (
                <p className="mt-1 text-xs text-slate-500">
                  À {currency.format(goal.monthlyContribution)} / mois, encore environ {goal.monthsRemaining} mois.
                </p>
              )}

              {goal.observedMonthlyPace !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  Rythme réellement observé : {currency.format(goal.observedMonthlyPace)} / mois
                  {goal.monthlyContribution !== null && (
                    <>
                      {" "}
                      (prévu : {currency.format(goal.monthlyContribution)} / mois
                      {goal.observedMonthlyPace < goal.monthlyContribution ? (
                        <span className="text-amber-600"> — en retard</span>
                      ) : (
                        <span className="text-emerald-600"> — au rythme prévu</span>
                      )}
                      )
                    </>
                  )}
                </p>
              )}

              {!goal.achieved && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="w-40 input"
                    placeholder="Montant (+/-)"
                    inputMode="decimal"
                    value={contributionInputs[goal.id] ?? ""}
                    onChange={(e) => setContributionInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => handleContribute(goal.id)}
                    className="btn btn-secondary"
                  >
                    Ajouter une contribution
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
