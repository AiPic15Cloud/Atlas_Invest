import { useState, type FormEvent } from "react";
import type { BankAccount, IncomeNature } from "../api/types";

const COMMON_SOURCES = ["Salaire", "Freelance", "Dividendes", "Allocations", "Autre"];

export const INCOME_NATURE_LABELS: Record<IncomeNature, string> = {
  RECURRENT: "Récurrent",
  EXCEPTIONNEL: "Exceptionnel",
  REMBOURSEMENT: "Remboursement",
  AUTRE: "Autre",
};

interface IncomeFormProps {
  accounts: BankAccount[];
  onSubmit: (data: { source: string; nature: IncomeNature; amount: number; bankAccountId: string }) => Promise<void>;
  onCancel: () => void;
}

export function IncomeForm({ accounts, onSubmit, onCancel }: IncomeFormProps) {
  const [source, setSource] = useState("");
  const [nature, setNature] = useState<IncomeNature>("RECURRENT");
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Montant invalide.");
      return;
    }
    if (!bankAccountId) {
      setError("Choisis un compte bancaire.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ source, nature, amount: parsedAmount, bankAccountId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
      <div>
        <label htmlFor="income-source" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Source
        </label>
        <input
          id="income-source"
          list="income-sources"
          required
          autoFocus
          placeholder="Ex. Salaire"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full input px-3 py-1.5 text-sm"
        />
        <datalist id="income-sources">
          {COMMON_SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor="income-account" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Compte bancaire
        </label>
        <select
          id="income-account"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          className="w-full input px-3 py-1.5 text-sm"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="income-nature" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Nature
        </label>
        <select
          id="income-nature"
          value={nature}
          onChange={(e) => setNature(e.target.value as IncomeNature)}
          className="w-full input px-3 py-1.5 text-sm"
        >
          {(Object.keys(INCOME_NATURE_LABELS) as IncomeNature[]).map((n) => (
            <option key={n} value={n}>
              {INCOME_NATURE_LABELS[n]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="income-amount" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Montant (€)
        </label>
        <input
          id="income-amount"
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full input px-3 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {submitting ? "Ajout..." : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
