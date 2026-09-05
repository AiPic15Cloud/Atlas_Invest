import { useState, type FormEvent } from "react";
import { parseQuickExpense } from "../lib/parseQuickExpense";
import type { BankAccount, ExpenseCategory } from "../api/types";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
  INVESTISSEMENT: "Investissement",
  REMBOURSEMENT_DETTE: "Remboursement de dette",
};

interface QuickAddExpenseProps {
  accounts: BankAccount[];
  onSubmit: (data: { poste: string; amount: number; category: ExpenseCategory; bankAccountId: string }) => Promise<void>;
}

export function QuickAddExpense({ accounts, onSubmit }: QuickAddExpenseProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("BESOINS");
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseQuickExpense(text);
    if (!parsed) {
      setError("Indique un montant, ex. « courses 42€ ».");
      return;
    }
    if (!bankAccountId) {
      setError("Choisis un compte bancaire.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ poste: parsed.poste, amount: parsed.amount, category, bankAccountId });
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <label htmlFor="quick-expense" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Ajout rapide
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="quick-expense"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. courses 42€"
          className="min-w-[180px] flex-1 input"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="input px-2 py-2 text-sm"
          aria-label="Catégorie"
        >
          {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {accounts.length > 1 && (
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="input px-2 py-2 text-sm"
            aria-label="Compte bancaire"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
        >
          Ajouter
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
