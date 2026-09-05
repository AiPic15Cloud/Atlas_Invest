import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconArrowsExchange } from "../components/icons";
import type { BankAccountsResponse, TransfersResponse } from "../api/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function Transferts() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<TransfersResponse | null>(null);
  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableAccounts = useMemo(
    () => [...(accounts?.mine ?? []), ...(accounts?.joint ?? [])],
    [accounts],
  );

  async function load() {
    try {
      const [transfersRes, accountsRes] = await Promise.all([
        apiFetch<TransfersResponse>("/api/transfers"),
        apiFetch<BankAccountsResponse>("/api/bank-accounts"),
      ]);
      setData(transfersRes);
      setAccounts(accountsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les transferts.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (availableAccounts.length < 2) return;
    if (!fromAccountId) setFromAccountId(availableAccounts[0].id);
    if (!toAccountId) setToAccountId(availableAccounts[1].id);
  }, [availableAccounts, fromAccountId, toAccountId]);

  async function handleAdd() {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Choisis deux comptes différents et un montant valide.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/transfers", {
        method: "POST",
        body: JSON.stringify({ fromAccountId, toAccountId, amount: parsedAmount, date, note: note.trim() || undefined }),
      });
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce virement ?")) return;
    try {
      await apiFetch(`/api/transfers/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data || !accounts) return <p className="text-sm text-slate-500">Chargement...</p>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconArrowsExchange className="h-6 w-6 text-violet-600" />
          Transferts
        </h1>
        <p className="text-sm text-slate-500">
          Un virement compte à compte n'est ni un revenu ni une dépense pour le foyer — il est enregistré ici, à
          part, pour ne jamais fausser tes totaux.
        </p>
      </div>

      {availableAccounts.length < 2 ? (
        <p className="card text-sm text-slate-500">
          Il te faut au moins deux comptes bancaires pour enregistrer un transfert.
        </p>
      ) : (
        <section className="card">
          <h2 className="font-semibold">Nouveau transfert</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="transfer-from" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Depuis
              </label>
              <select
                id="transfer-from"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="input px-2 py-1.5 text-sm"
              >
                {availableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transfer-to" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Vers
              </label>
              <select
                id="transfer-to"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="input px-2 py-1.5 text-sm"
              >
                {availableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transfer-amount" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Montant (€)
              </label>
              <input
                id="transfer-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex. 300"
                className="w-28 input px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="transfer-date" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <input
                id="transfer-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <label htmlFor="transfer-note" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Note (optionnel)
              </label>
              <input
                id="transfer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. épargne du mois"
                className="w-full input px-2 py-1.5 text-sm"
              />
            </div>
            <button onClick={handleAdd} disabled={submitting} className="btn btn-primary">
              {submitting ? "..." : "Enregistrer"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold">Historique</h2>
        {data.transfers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun transfert enregistré pour l'instant.</p>
        ) : (
          <ul className="mt-2">
            {data.transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">
                    {t.fromAccountName} → {t.toAccountName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.date).toLocaleDateString("fr-FR")}
                    {t.note ? ` — ${t.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{currency.format(Number(t.amount))}</span>
                  <button onClick={() => handleDelete(t.id)} className="text-xs text-slate-400 hover:text-red-600">
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
