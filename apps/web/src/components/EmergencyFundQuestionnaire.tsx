import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { CriterionValue, EmergencyFundCriteria } from "../api/types";

type Answers = Record<keyof EmergencyFundCriteria, CriterionValue>;

interface EmergencyFundQuestionnaireProps {
  initialAnswers?: Record<keyof EmergencyFundCriteria, number>;
  onSubmit: (answers: Answers) => Promise<void>;
  onCancel?: () => void;
}

export function EmergencyFundQuestionnaire({ initialAnswers, onSubmit, onCancel }: EmergencyFundQuestionnaireProps) {
  const [criteria, setCriteria] = useState<EmergencyFundCriteria | null>(null);
  const [answers, setAnswers] = useState<Partial<Answers>>((initialAnswers as Partial<Answers>) ?? {});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ criteria: EmergencyFundCriteria }>("/api/emergency-fund/criteria").then((res) =>
      setCriteria(res.criteria),
    );
  }, []);

  if (!criteria) return <p className="text-sm text-slate-500">Chargement...</p>;

  const keys = Object.keys(criteria) as (keyof EmergencyFundCriteria)[];

  async function handleSubmit() {
    setError(null);
    const missing = keys.filter((k) => answers[k] === undefined);
    if (missing.length > 0) {
      setError("Réponds à toutes les questions.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(answers as Answers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Ces réponses permettent d'estimer un objectif d'épargne de précaution adapté à ta situation. Rien n'est
        figé : tu pourras ajuster le nombre de mois ensuite.
      </p>
      {keys.map((key) => (
        <fieldset key={key} className="card">
          <legend className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">{criteria[key].question}</legend>
          <div className="space-y-1.5">
            {criteria[key].options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name={key}
                  checked={answers[key] === option.value}
                  onChange={() => setAnswers((prev) => ({ ...prev, [key]: option.value }))}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? "Calcul..." : "Calculer mon objectif"}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
