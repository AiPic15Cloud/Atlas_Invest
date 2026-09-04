import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { BankAccountsResponse, RecurringChargesResponse } from "../api/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function Echeances() {
  const [data, setData] = useState<RecurringChargesResponse | null>(null);
  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [bankAccountId, setBankAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableAccounts = useMemo(
    () => [...(accounts?.mine ?? []), ...(accounts?.joint ?? [])],
    [accounts],
  );

  async function load() {
    try {
      const [chargesRes, accountsRes] = await Promise.all([
        apiFetch<RecurringChargesResponse>("/api/recurring-charges"),
        apiFetch<BankAccountsResponse>("/api/bank-accounts"),
      ]);
      setData(chargesRes);
      setAccounts(accountsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le calendrier des échéances.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!bankAccountId && availableAccounts.length > 0) {
      setBankAccountId(availableAccounts[0].id);
    }
  }, [availableAccounts, bankAccountId]);

  async function handleAdd() {
    const parsedAmount = Number(amount.replace(",", "."));
    const parsedDay = Number(dayOfMonth);
    if (!label.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !bankAccountId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/recurring-charges", {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), amount: parsedAmount, dayOfMonth: parsedDay, bankAccountId }),
      });
      setLabel("");
      setAmount("");
      setDayOfMonth("1");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    try {
      await apiFetch(`/api/recurring-charges/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette échéance ?")) return;
    try {
      await apiFetch(`/api/recurring-charges/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  const sortedCharges = [...data.charges].sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <span className="text-lg font-semibold">Calendrier des échéances</span>
        <p className="mt-1 text-sm text-slate-500">
          Loyer, crédits, factures... déclare tes prélèvements récurrents pour les voir classés par date et
          repérer un risque de découvert avant qu'il arrive.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data.accounts.some((a) => a.alert) && (
        <section className="space-y-2 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
          <h2 className="font-semibold text-red-800">Alerte de solde prévisionnel</h2>
          {data.accounts
            .filter((a) => a.alert)
            .map((a) => (
              <p key={a.id} className="text-sm text-red-700">
                Le compte <span className="font-medium">{a.name}</span> risque de passer en négatif
                ({currency.format(a.alert!.projectedBalance)}) autour du {a.alert!.dayOfMonth} du mois, en
                cumulant les échéances déclarées à partir d'un solde de {currency.format(a.currentBalance)}.
              </p>
            ))}
          <p className="text-xs text-red-500">
            Cette projection ne tient compte que des échéances déclarées ci-dessous et du solde renseigné pour
            le compte ; elle ne prend pas en compte tes revenus ou autres dépenses du mois.
          </p>
        </section>
      )}

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Ajouter une échéance</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Libellé (ex. Loyer)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Montant"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={1}
            max={31}
            placeholder="Jour du mois"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
          >
            {availableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={submitting || availableAccounts.length === 0}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "..." : "Ajouter"}
        </button>
        {availableAccounts.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">Ajoute d'abord un compte bancaire.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Échéances du mois, par date</h2>
        {sortedCharges.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune échéance déclarée pour l'instant.</p>
        ) : (
          <ul className="mt-2">
            {sortedCharges.map((c) => (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0 ${
                  c.active ? "" : "opacity-50"
                }`}
              >
                <span className="w-10 shrink-0 rounded-md bg-slate-100 py-1 text-center text-xs font-semibold text-slate-600">
                  {c.dayOfMonth}
                </span>
                <span className="flex-1 text-sm">
                  {c.label} <span className="text-slate-400">— {c.bankAccountName}</span>
                </span>
                <span className="text-sm font-medium">{currency.format(Number(c.amount))}</span>
                <button
                  onClick={() => handleToggleActive(c.id, !c.active)}
                  className="text-xs text-slate-500 underline"
                >
                  {c.active ? "Suspendre" : "Réactiver"}
                </button>
                <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 underline">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.subscriptionsWithoutDate.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Abonnements actifs (date de prélèvement non précisée)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Détectés automatiquement via tes dépenses (voir Abonnements) mais sans date fixe déclarée : ils ne
            sont pas inclus dans la projection de solde ci-dessus.
          </p>
          <ul className="mt-2">
            {data.subscriptionsWithoutDate.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm">{s.poste}</span>
                <span className="text-sm font-medium">{currency.format(s.amount)} / mois</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
