import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconFlag } from "../components/icons";
import type { SavingsGoal, SavingsGoalsResponse } from "../api/types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

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
  }, []);

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

      {goals.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun objectif pour l'instant.</p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <section key={goal.id} className="card">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {goal.name} {goal.achieved && <span className="text-emerald-600">✓ atteint</span>}
                </h3>
                <button onClick={() => handleDelete(goal.id)} className="text-xs text-red-500 underline">
                  Supprimer
                </button>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${goal.achieved ? "bg-emerald-500" : "bg-violet-600"}`}
                  style={{ width: `${Math.round(goal.progressRatio * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-slate-600">
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
