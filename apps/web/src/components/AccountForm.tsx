import { useState, type FormEvent } from "react";
import type { BankAccountType } from "../api/types";

const PERSONAL_TYPES: { value: BankAccountType; label: string }[] = [
  { value: "COURANT", label: "Compte courant" },
  { value: "LIVRET", label: "Livret" },
  { value: "PRO", label: "Compte pro" },
  { value: "AUTRE", label: "Autre" },
];

interface AccountFormProps {
  variant: "personal" | "joint";
  onSubmit: (data: { name: string; type: BankAccountType; initialBalance: number }) => Promise<void>;
  onCancel: () => void;
}

export function AccountForm({ variant, onSubmit, onCancel }: AccountFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BankAccountType>(variant === "joint" ? "JOINT" : "COURANT");
  const [initialBalance, setInitialBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedBalance = Number(initialBalance.replace(",", "."));
    if (Number.isNaN(parsedBalance)) {
      setError("Montant invalide.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name, type, initialBalance: parsedBalance });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div>
        <label htmlFor={`${variant}-account-name`} className="mb-1 block text-xs font-medium text-slate-700">
          Nom du compte
        </label>
        <input
          id={`${variant}-account-name`}
          required
          autoFocus
          placeholder={variant === "joint" ? "Ex. Compte joint" : "Ex. Compte courant Boursorama"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full input px-3 py-1.5 text-sm"
        />
      </div>
      {variant === "personal" && (
        <div>
          <label htmlFor={`${variant}-account-type`} className="mb-1 block text-xs font-medium text-slate-700">
            Type
          </label>
          <select
            id={`${variant}-account-type`}
            value={type}
            onChange={(e) => setType(e.target.value as BankAccountType)}
            className="w-full input px-3 py-1.5 text-sm"
          >
            {PERSONAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${variant}-account-balance`} className="mb-1 block text-xs font-medium text-slate-700">
          Solde actuel (€)
        </label>
        <input
          id={`${variant}-account-balance`}
          inputMode="decimal"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
          className="w-full input px-3 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-pink-600 hover:bg-pink-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Ajout..." : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
