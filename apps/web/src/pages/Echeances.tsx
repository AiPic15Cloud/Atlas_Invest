import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconClock } from "../components/icons";
import type {
  AnticipatedExpensesResponse,
  BankAccountsResponse,
  ProvisionsResponse,
  RecurringChargesResponse,
  RiskyMonthsResponse,
} from "../api/types";

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function Echeances() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<RecurringChargesResponse | null>(null);
  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [bankAccountId, setBankAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [provisions, setProvisions] = useState<ProvisionsResponse | null>(null);
  const [provisionLabel, setProvisionLabel] = useState("");
  const [provisionAnnualAmount, setProvisionAnnualAmount] = useState("");
  const [provisionSubmitting, setProvisionSubmitting] = useState(false);

  const [riskyMonths, setRiskyMonths] = useState<RiskyMonthsResponse | null>(null);
  const [anticipated, setAnticipated] = useState<AnticipatedExpensesResponse | null>(null);
  const [anticipatedLabel, setAnticipatedLabel] = useState("");
  const [anticipatedAmount, setAnticipatedAmount] = useState("");
  const [anticipatedMonth, setAnticipatedMonth] = useState("");
  const [anticipatedSubmitting, setAnticipatedSubmitting] = useState(false);

  const availableAccounts = useMemo(
    () => [...(accounts?.mine ?? []), ...(accounts?.joint ?? [])],
    [accounts],
  );

  async function load() {
    try {
      const [chargesRes, accountsRes, provisionsRes, riskyMonthsRes, anticipatedRes] = await Promise.all([
        apiFetch<RecurringChargesResponse>("/api/recurring-charges"),
        apiFetch<BankAccountsResponse>("/api/bank-accounts"),
        apiFetch<ProvisionsResponse>("/api/provisions"),
        apiFetch<RiskyMonthsResponse>("/api/risky-months"),
        apiFetch<AnticipatedExpensesResponse>("/api/risky-months/anticipated"),
      ]);
      setData(chargesRes);
      setAccounts(accountsRes);
      setProvisions(provisionsRes);
      setRiskyMonths(riskyMonthsRes);
      setAnticipated(anticipatedRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le calendrier des échéances.");
    }
  }

  async function handleAddAnticipated() {
    const parsedAmount = Number(anticipatedAmount.replace(",", "."));
    if (!anticipatedLabel.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !anticipatedMonth) return;
    const [yearStr, monthStr] = anticipatedMonth.split("-");
    setAnticipatedSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/risky-months/anticipated", {
        method: "POST",
        body: JSON.stringify({
          label: anticipatedLabel.trim(),
          amount: parsedAmount,
          year: Number(yearStr),
          month: Number(monthStr),
        }),
      });
      setAnticipatedLabel("");
      setAnticipatedAmount("");
      setAnticipatedMonth("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setAnticipatedSubmitting(false);
    }
  }

  async function handleDeleteAnticipated(id: string) {
    if (!confirm("Supprimer cette dépense anticipée ?")) return;
    try {
      await apiFetch(`/api/risky-months/anticipated/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleAddProvision() {
    const parsedAnnual = Number(provisionAnnualAmount.replace(",", "."));
    if (!provisionLabel.trim() || !Number.isFinite(parsedAnnual) || parsedAnnual <= 0) return;
    setProvisionSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/provisions", {
        method: "POST",
        body: JSON.stringify({ label: provisionLabel.trim(), annualAmount: parsedAnnual }),
      });
      setProvisionLabel("");
      setProvisionAnnualAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setProvisionSubmitting(false);
    }
  }

  async function handleToggleProvisionActive(id: string, active: boolean) {
    try {
      await apiFetch(`/api/provisions/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleDeleteProvision(id: string) {
    if (!confirm("Supprimer cette provision ?")) return;
    try {
      await apiFetch(`/api/provisions/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
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
    <div className="space-y-4 sm:space-y-6">
      <div className="card p-3">
        <span className="text-lg font-semibold flex items-center gap-2">
          <IconClock className="h-5 w-5 text-violet-600" />
          Calendrier des échéances
        </span>
        <p className="mt-1 text-sm text-slate-500">
          Loyer, crédits, factures... déclare tes prélèvements récurrents pour les voir classés par date et
          repérer un risque de découvert avant qu'il arrive.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data.accounts.some((a) => a.alert) && (
        <section className="space-y-2 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
          <h2 className="font-semibold text-red-800 dark:text-red-300">Alerte de solde prévisionnel</h2>
          {data.accounts
            .filter((a) => a.alert)
            .map((a) => (
              <p key={a.id} className="text-sm text-red-700 dark:text-red-400">
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

      <section className="card">
        <h2 className="font-semibold">Ajouter une échéance</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            className="input sm:col-span-2"
            placeholder="Libellé (ex. Loyer)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="input"
            placeholder="Montant"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="input"
            type="number"
            min={1}
            max={31}
            placeholder="Jour du mois"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
          <select
            className="input"
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
          className="mt-3 btn btn-primary"
        >
          {submitting ? "..." : "Ajouter"}
        </button>
        {availableAccounts.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">Ajoute d'abord un compte bancaire.</p>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold">Échéances du mois, par date</h2>
        {sortedCharges.length > 0 && (
          <p className="mt-1 text-sm text-slate-500">
            Total des échéances actives : {currency.format(data.totalMonthlyActive)} / mois ·{" "}
            {currency.format(data.totalAnnualActive)} / an
          </p>
        )}
        {sortedCharges.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune échéance déclarée pour l'instant.</p>
        ) : (
          <ul className="mt-2">
            {sortedCharges.map((c) => (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-2 last:border-0 ${
                  c.active ? "" : "opacity-50"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                  {c.dayOfMonth}
                </span>
                <span className="flex-1 text-sm">
                  {c.label} <span className="text-slate-400">— {c.bankAccountName}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="font-medium">{currency.format(Number(c.amount))}</span>
                  <span className="block text-xs text-slate-400">{currency.format(c.annualAmount)} / an</span>
                </span>
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

      <section className="card">
        <h2 className="font-semibold">Provisions pour dépenses annuelles</h2>
        <p className="mt-1 text-sm text-[#8a7358]">
          Assurance, taxe foncière, vacances, entretien voiture... déclare le montant annuel : Atlas le
          mensualise et le compte comme de l'argent déjà affecté, déduit de ton "argent réellement disponible".
        </p>

        {provisions && provisions.provisions.length > 0 && (
          <ul className="mt-3">
            {provisions.provisions.map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-3 border-b border-[#ece0cb] dark:border-[#3a2a1c] py-2 last:border-0 ${
                  p.active ? "" : "opacity-50"
                }`}
              >
                <span className="flex-1 text-sm">{p.label}</span>
                <span className="text-sm font-medium">
                  {currency.format(p.monthlyAmount)}/mois
                  <span className="ml-1 text-xs text-[#a8927a]">({currency.format(p.annualAmount)}/an)</span>
                </span>
                <button
                  onClick={() => handleToggleProvisionActive(p.id, !p.active)}
                  className="text-xs text-[#a8927a] hover:text-copper-600"
                >
                  {p.active ? "Suspendre" : "Réactiver"}
                </button>
                <button onClick={() => handleDeleteProvision(p.id)} className="text-xs text-[#a8927a] hover:text-terracotta-600">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
        {provisions && provisions.activeMonthlyTotal > 0 && (
          <p className="mt-2 text-sm font-medium text-copper-700 dark:text-copper-300">
            Total provisionné : {currency.format(provisions.activeMonthlyTotal)}/mois
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="input sm:col-span-2"
            placeholder="Libellé (ex. Assurance habitation)"
            value={provisionLabel}
            onChange={(e) => setProvisionLabel(e.target.value)}
          />
          <input
            className="input"
            placeholder="Montant annuel (€)"
            inputMode="decimal"
            value={provisionAnnualAmount}
            onChange={(e) => setProvisionAnnualAmount(e.target.value)}
          />
        </div>
        <button
          onClick={handleAddProvision}
          disabled={provisionSubmitting}
          className="mt-3 btn btn-primary"
        >
          {provisionSubmitting ? "..." : "Ajouter la provision"}
        </button>
      </section>

      <section className="card">
        <h2 className="font-semibold">Mois à risque</h2>
        <p className="mt-1 text-sm text-slate-500">
          Estimation sur les 6 prochains mois, à partir de ton revenu récurrent actuel et de tes charges connues
          (échéances + provisions). Ajoute une dépense ponctuelle déjà prévue (Noël, impôts, gros entretien...)
          pour voir si elle ferait basculer un mois en déficit.
        </p>

        {riskyMonths && !riskyMonths.hasIncomeData && (
          <p className="mt-2 text-xs text-amber-600">
            Aucun revenu récurrent déclaré ce mois-ci : cette estimation ne peut pas être calculée.
          </p>
        )}

        {riskyMonths && riskyMonths.hasIncomeData && (
          <ul className="mt-3">
            {riskyMonths.months.map((m) => (
              <li
                key={`${m.year}-${m.month}`}
                className="border-b border-slate-100 dark:border-slate-800 py-2 last:border-0"
              >
                <p className={`text-sm ${m.risky ? "font-medium text-red-700 dark:text-red-400" : ""}`}>
                  <span className="capitalize">{MONTH_LABEL.format(new Date(m.year, m.month - 1, 1))}</span>
                  {m.risky && " — probablement tendu"}
                </p>
                <p className="text-xs text-slate-400">
                  Revenus attendus ~{currency.format(m.projectedIncome)} · Charges prévues ~
                  {currency.format(m.projectedCharges)}
                  {m.risky && m.requiredMonthlyProvision !== null && (
                    <> — il faudrait provisionner environ {currency.format(m.requiredMonthlyProvision)}/mois jusque-là.</>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}

        {anticipated && anticipated.expenses.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400">Dépenses ponctuelles anticipées</h3>
            <ul className="mt-1">
              {anticipated.expenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-2 last:border-0"
                >
                  <span className="flex-1 text-sm">
                    {e.label}{" "}
                    <span className="text-slate-400 capitalize">
                      — {MONTH_LABEL.format(new Date(e.year, e.month - 1, 1))}
                    </span>
                  </span>
                  <span className="text-sm font-medium">{currency.format(e.amount)}</span>
                  <button onClick={() => handleDeleteAnticipated(e.id)} className="text-xs text-red-500 underline">
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="input sm:col-span-2"
            placeholder="Libellé (ex. Noël)"
            value={anticipatedLabel}
            onChange={(e) => setAnticipatedLabel(e.target.value)}
          />
          <input
            className="input"
            placeholder="Montant"
            inputMode="decimal"
            value={anticipatedAmount}
            onChange={(e) => setAnticipatedAmount(e.target.value)}
          />
          <input
            className="input"
            type="month"
            value={anticipatedMonth}
            onChange={(e) => setAnticipatedMonth(e.target.value)}
          />
        </div>
        <button onClick={handleAddAnticipated} disabled={anticipatedSubmitting} className="mt-3 btn btn-secondary">
          {anticipatedSubmitting ? "..." : "Ajouter la dépense anticipée"}
        </button>
      </section>

      {data.subscriptionsWithoutDate.length > 0 && (
        <section className="card">
          <h2 className="font-semibold">Abonnements actifs (date de prélèvement non précisée)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Détectés automatiquement via tes dépenses (voir Abonnements) mais sans date fixe déclarée : ils ne
            sont pas inclus dans la projection de solde ci-dessus.
          </p>
          <ul className="mt-2">
            {data.subscriptionsWithoutDate.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
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
