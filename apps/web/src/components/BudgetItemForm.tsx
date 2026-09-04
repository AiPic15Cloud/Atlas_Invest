import { useState, type FormEvent } from "react";

interface BudgetItemFormProps {
  initialName?: string;
  initialAmount?: number;
  initialEssential?: boolean;
  submitLabel: string;
  onSubmit: (data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function BudgetItemForm({
  initialName = "",
  initialAmount,
  initialEssential = true,
  submitLabel,
  onSubmit,
  onCancel,
}: BudgetItemFormProps) {
  const [name, setName] = useState(initialName);
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : "");
  const [essential, setEssential] = useState(initialEssential);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Montant invalide.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name, monthlyAmount: parsedAmount, essential });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Nom du poste</label>
        <input
          required
          autoFocus
          placeholder="Ex. Loyer"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-40 input px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Montant mensuel (€)</label>
        <input
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 input px-2 py-1 text-sm"
        />
      </div>
      <label className="mb-1 flex items-center gap-1 text-xs text-slate-700">
        <input type="checkbox" checked={essential} onChange={(e) => setEssential(e.target.checked)} />
        Essentiel
      </label>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-pink-600 hover:bg-pink-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {submitting ? "..." : submitLabel}
      </button>
      <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
        Annuler
      </button>
    </form>
  );
}
