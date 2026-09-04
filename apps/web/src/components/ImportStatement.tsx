import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { parseStatementText, type ImportGroup } from "../lib/importStatement";
import { extractPdfText } from "../lib/pdfText";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { BankAccount, BudgetCategory, Expense, ExpensesResponse } from "../api/types";

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
};

interface EditableGroup extends ImportGroup {
  poste: string;
  category: BudgetCategory;
  include: boolean;
  possibleDuplicate: boolean;
  fromMemory: boolean;
}

interface ImportStatementProps {
  year: number;
  month: number;
  accounts: BankAccount[];
  onDone: () => Promise<void>;
  onClose: () => void;
}

type ImportMemory = Record<string, { poste: string; category: BudgetCategory }>;

export function ImportStatement({ year, month, accounts, onDone, onClose }: ImportStatementProps) {
  const currency = useCurrencyFormatter();
  const [text, setText] = useState("");
  const [groups, setGroups] = useState<EditableGroup[] | null>(null);
  const [skipped, setSkipped] = useState<{ credits: number; unparsable: number; transfers: number } | null>(null);
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [memory, setMemory] = useState<ImportMemory>({});
  const [existingExpenses, setExistingExpenses] = useState<Expense[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ memory: ImportMemory }>("/api/import-memory")
      .then((res) => setMemory(res.memory))
      .catch(() => setMemory({}));
    apiFetch<ExpensesResponse>(`/api/expenses?year=${year}&month=${month}`)
      .then((res) => setExistingExpenses(res.expenses))
      .catch(() => setExistingExpenses([]));
  }, [year, month]);

  function handleAnalyze() {
    setError(null);
    const ownAccountNames = accounts.map((a) => a.name);
    const result = parseStatementText(text, ownAccountNames);
    if (result.groups.length === 0) {
      setError("Aucune dépense détectée dans le texte collé. Vérifie le format (CSV avec Date/Libellé/Montant, ou une ligne « libellé montant » par transaction).");
      setGroups(null);
      return;
    }
    setGroups(
      result.groups.map((g) => {
        const remembered = memory[g.merchantKey];
        const poste = remembered?.poste ?? g.suggestedPoste;
        const category = remembered?.category ?? g.suggestedCategory;
        const possibleDuplicate = existingExpenses.some(
          (e) => e.poste.trim().toLowerCase() === poste.trim().toLowerCase() && Math.abs(Number(e.amount) - g.total) < 0.01,
        );
        return { ...g, poste, category, include: !possibleDuplicate, possibleDuplicate, fromMemory: Boolean(remembered) };
      }),
    );
    setSkipped({ credits: result.skippedCredits, unparsable: result.skippedUnparsable, transfers: result.skippedTransfers });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setExtractingPdf(true);
      try {
        const content = await extractPdfText(file);
        if (!content.trim()) {
          setError("Aucun texte n'a pu être extrait de ce PDF (relevé scanné en image, par exemple).");
          return;
        }
        setText(content);
      } catch {
        setError("Impossible de lire ce PDF. Essaie d'exporter ton relevé en CSV, ou colle-le directement en texte.");
      } finally {
        setExtractingPdf(false);
      }
      return;
    }
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
      const memoryEntries = groups
        .filter((g) => g.include)
        .map((g) => ({ merchantKey: g.merchantKey, poste: g.poste.trim() || "Autre", category: g.category }));
      if (memoryEntries.length > 0) {
        await apiFetch("/api/import-memory/bulk", { method: "POST", body: JSON.stringify({ entries: memoryEntries }) }).catch(() => {});
      }
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
    <div className="card">
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
            transaction), ou choisis un fichier .csv/.txt/.pdf. Seules les dépenses (montants négatifs ou colonne
            débit) sont détectées. Pour un PDF, le texte est extrait directement dans ton navigateur.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Date;Libellé;Montant\n12/09/2026;CARREFOUR MARKET;-42,50\n13/09/2026;NETFLIX.COM;-13,49"}
            className="w-full input px-3 py-2 font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.pdf,application/pdf"
              onChange={handleFileChange}
              disabled={extractingPdf}
              className="text-xs"
            />
            {extractingPdf && <span className="text-xs text-slate-500">Lecture du PDF...</span>}
            <button
              onClick={handleAnalyze}
              disabled={!text.trim() || extractingPdf}
              className="btn btn-primary"
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
              {skipped && skipped.transfers > 0 && ` · ${skipped.transfers} virement(s) interne(s) écarté(s)`}
              {skipped && skipped.unparsable > 0 && ` · ${skipped.unparsable} ligne(s) non reconnue(s)`}
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="import-account" className="font-medium text-slate-700">Compte :</label>
              <select
                id="import-account"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="input px-2 py-1 text-xs"
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
                  <tr key={g.merchantKey} className={`border-t border-slate-100 ${g.possibleDuplicate ? "bg-amber-50" : ""}`}>
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
                      {g.possibleDuplicate && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          doublon probable
                        </span>
                      )}
                      {!g.possibleDuplicate && g.fromMemory && (
                        <span className="ml-1 rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] font-medium text-pink-600">
                          mémorisé
                        </span>
                      )}
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
              className="btn btn-primary"
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
