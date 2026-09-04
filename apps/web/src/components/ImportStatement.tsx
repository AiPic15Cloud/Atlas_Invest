import { useRef, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { parseStatementText, type ImportGroup } from "../lib/importStatement";
import type { BankAccount, BudgetCategory } from "../api/types";

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
};

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

interface EditableGroup extends ImportGroup {
  poste: string;
  category: BudgetCategory;
  include: boolean;
}

interface ImportStatementProps {
  year: number;
  month: number;
  accounts: BankAccount[];
  onDone: () => Promise<void>;
  onClose: () => void;
}

export function ImportStatement({ year, month, accounts, onDone, onClose }: ImportStatementProps) {
  const [text, setText] = useState("");
  const [groups, setGroups] = useState<EditableGroup[] | null>(null);
  const [skipped, setSkipped] = useState<{ credits: number; unparsable: number } | null>(null);
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAnalyze() {
    setError(null);
    const result = parseStatementText(text);
    if (result.groups.length === 0) {
      setError("Aucune dépense détectée dans le texte collé. Vérifie le format (CSV avec Date/Libellé/Montant, ou une ligne « libellé montant » par transaction).");
      setGroups(null);
      return;
    }
    setGroups(result.groups.map((g) => ({ ...g, poste: g.suggestedPoste, category: g.suggestedCategory, include: true })));
    setSkipped({ credits: result.skippedCredits, unparsable: result.skippedUnparsable });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  }

  function updateGroup(key: string, patch: Partial<EditableGroup>) {
    setGroups((prev) => (prev ? prev.map((g) => (g.merchantKey === key ? { ...g, ...patch } : g)) : prev));
  }

  const totalToImport = (groups ?? [])
    .filter((g) => g.include)
    .reduce((sum, g) => sum + g.transactions.length, 0);

  async function handleConfirm() {
    if (!groups) return;
    if (!bankAccountId) {
      setError("Choisis un compte bancaire.");
      return;
    }
    const items = groups
      .filter((g) => g.include)
      .flatMap((g) =>
        g.transactions.map((tx) => ({
          poste: g.poste.trim() || "Autre",
          category: g.category,
          amount: tx.amount,
          note: [tx.date, tx.description].filter(Boolean).join(" — ").slice(0, 200) || undefined,
        })),
      );
    if (items.length === 0) {
      setError("Sélectionne au moins un marchand à importer.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ created: number }>("/api/expenses/bulk", {
        method: "POST",
        body: JSON.stringify({ year, month, bankAccountId, items }),
      });
      await onDone();
      alert(`${res.created} dépense(s) importée(s).`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Importer un relevé</h2>
        <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:underline">
          Fermer
        </button>
      </div>

      {!groups ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            Colle le contenu de ton relevé (export CSV de ta banque, ou une ligne « libellé montant » par
            transaction), ou choisis un fichier .csv/.txt. Seules les dépenses (montants négatifs ou colonne
            débit) sont détectées.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Date;Libellé;Montant\n12/09/2026;CARREFOUR MARKET;-42,50\n13/09/2026;NETFLIX.COM;-13,49"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="text-xs" />
            <button
              onClick={handleAnalyze}
              disabled={!text.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Analyser
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {groups.length} marchand(s) détecté(s), {totalToImport} transaction(s) prête(s) à importer
              {skipped && skipped.credits > 0 && ` · ${skipped.credits} crédit(s) ignoré(s)`}
              {skipped && skipped.unparsable > 0 && ` · ${skipped.unparsable} ligne(s) non reconnue(s)`}
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="import-account" className="font-medium text-slate-700">Compte :</label>
              <select
                id="import-account"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1.5"></th>
                  <th className="px-2 py-1.5">Poste</th>
                  <th className="px-2 py-1.5">Catégorie</th>
                  <th className="px-2 py-1.5">Transactions</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.merchantKey} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={g.include}
                        onChange={(e) => updateGroup(g.merchantKey, { include: e.target.checked })}
                        aria-label={`Inclure ${g.poste}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={g.poste}
                        onChange={(e) => updateGroup(g.merchantKey, { poste: e.target.value })}
                        className="w-32 rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={g.category}
                        onChange={(e) => updateGroup(g.merchantKey, { category: e.target.value as BudgetCategory })}
                        className="rounded border border-slate-200 px-1.5 py-1 text-xs"
                      >
                        {(Object.entries(CATEGORY_LABELS) as [BudgetCategory, string][]).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500" title={g.transactions.map((t) => t.description).join(", ")}>
                      {g.transactions.length}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium">{currency.format(g.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Import..." : `Valider et intégrer ${totalToImport} dépense(s)`}
            </button>
            <button onClick={() => setGroups(null)} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Recommencer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
