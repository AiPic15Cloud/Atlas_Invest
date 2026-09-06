import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconBuilding, IconWallet, IconUsers, IconArrowsExchange, IconChartLine } from "../components/icons";
import { StatTile } from "../components/StatTile";
import type {
  AssetValuationsResponse,
  DebtCockpitResponse,
  Loan,
  LoansResponse,
  ValuationSource,
  WealthCategory,
  WealthItem,
  WealthResponse,
  WealthVariationResponse,
} from "../api/types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const VALUATION_SOURCE_LABELS: Record<ValuationSource, string> = {
  MANUELLE: "saisie manuelle",
  MARCHE: "prix de marché",
  ESTIMATION: "estimation",
  HISTORIQUE: "prix historique",
};

function ValuationRow({
  item,
  categoryLabel,
  currency,
  onDelete,
  onUpdated,
}: {
  item: WealthItem;
  categoryLabel: string;
  currency: Intl.NumberFormat;
  onDelete: (id: string) => void;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [source, setSource] = useState<ValuationSource>("MANUELLE");
  const [history, setHistory] = useState<AssetValuationsResponse["valuations"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadHistory() {
    try {
      const res = await apiFetch<AssetValuationsResponse>(`/api/wealth/${item.id}/valuations`);
      setHistory(res.valuations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'historique.");
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !history) {
      await loadHistory();
    }
  }

  async function handleSubmit() {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/wealth/${item.id}/valuations`, {
        method: "POST",
        body: JSON.stringify({ value: parsed, source }),
      });
      setValue("");
      onUpdated();
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          {item.label} <span className="text-slate-400">({categoryLabel})</span>
          {item.lastValuationSource && (
            <span className="ml-1 text-xs text-slate-400">
              — {VALUATION_SOURCE_LABELS[item.lastValuationSource]}
              {item.lastValuationDate ? `, ${dayFormat.format(new Date(item.lastValuationDate))}` : ""}
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${item.kind === "LIABILITY" ? "text-red-600" : ""}`}>
            {item.kind === "LIABILITY" ? "− " : ""}
            {currency.format(Number(item.amount))}
          </span>
          <button onClick={toggle} className="text-xs link">
            {open ? "Fermer" : "Mettre à jour"}
          </button>
          <button onClick={() => onDelete(item.id)} className="text-xs text-red-500 underline">
            Supprimer
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2 rounded-lg border border-slate-100 dark:border-slate-800 p-2">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500">Nouvelle valeur (€)</label>
              <input
                className="input w-28 px-2 py-1 text-sm"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Source</label>
              <select
                className="input px-2 py-1 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value as ValuationSource)}
              >
                {(Object.keys(VALUATION_SOURCE_LABELS) as ValuationSource[]).map((s) => (
                  <option key={s} value={s}>
                    {VALUATION_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary px-2 py-1 text-xs">
              {submitting ? "..." : "Enregistrer"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

          {history && history.length > 0 && (
            <ul className="mt-2 space-y-1">
              {history.map((v) => (
                <li key={v.id} className="text-xs text-slate-500">
                  {dayFormat.format(new Date(v.valuationDate))} — {currency.format(Number(v.value))} (
                  {VALUATION_SOURCE_LABELS[v.source]})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function Patrimoine() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<WealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<WealthCategory>("PLACEMENT");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanLabel, setLoanLabel] = useState("");
  const [loanPrincipal, setLoanPrincipal] = useState("");
  const [loanRemaining, setLoanRemaining] = useState("");
  const [loanMonthlyPayment, setLoanMonthlyPayment] = useState("");
  const [loanInterestRate, setLoanInterestRate] = useState("");
  const [loanStartDate, setLoanStartDate] = useState("");
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [paymentTotalInputs, setPaymentTotalInputs] = useState<Record<string, string>>({});
  const [paymentInterestInputs, setPaymentInterestInputs] = useState<Record<string, string>>({});
  const [archivedLoans, setArchivedLoans] = useState<Loan[] | null>(null);
  const [showArchivedLoans, setShowArchivedLoans] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<WealthResponse>("/api/wealth");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le patrimoine.");
    }
  }

  async function loadLoans() {
    try {
      const res = await apiFetch<LoansResponse>("/api/loans");
      setLoans(res.loans);
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Impossible de charger les prêts.");
    }
  }

  async function loadArchivedLoans() {
    try {
      const res = await apiFetch<LoansResponse>("/api/loans/archived");
      setArchivedLoans(res.loans);
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Impossible de charger les prêts archivés.");
    }
  }

  useEffect(() => {
    load();
    loadLoans();
  }, []);

  async function handleAdd() {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!label.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/wealth", {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), category, amount: parsedAmount }),
      });
      setLabel("");
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet élément ?")) return;
    try {
      await apiFetch(`/api/wealth/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleAddLoan() {
    const principal = Number(loanPrincipal.replace(",", "."));
    const monthlyPayment = Number(loanMonthlyPayment.replace(",", "."));
    if (!loanLabel.trim() || !Number.isFinite(principal) || principal <= 0) return;
    if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) return;
    if (!loanStartDate) return;
    setLoanSubmitting(true);
    setLoanError(null);
    try {
      const remaining = loanRemaining ? Number(loanRemaining.replace(",", ".")) : undefined;
      const rate = loanInterestRate ? Number(loanInterestRate.replace(",", ".")) : null;
      await apiFetch("/api/loans", {
        method: "POST",
        body: JSON.stringify({
          label: loanLabel.trim(),
          principalAmount: principal,
          remainingBalance: remaining,
          monthlyPayment,
          interestRate: rate,
          startDate: new Date(`${loanStartDate}-01T00:00:00.000Z`).toISOString(),
        }),
      });
      setLoanLabel("");
      setLoanPrincipal("");
      setLoanRemaining("");
      setLoanMonthlyPayment("");
      setLoanInterestRate("");
      setLoanStartDate("");
      await loadLoans();
      await load();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setLoanSubmitting(false);
    }
  }

  async function handleRecordPayment(id: string) {
    const totalAmount = Number((paymentTotalInputs[id] ?? "").replace(",", "."));
    const interestPlusInsurance = Number((paymentInterestInputs[id] ?? "0").replace(",", ".") || "0");
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return;
    if (!Number.isFinite(interestPlusInsurance) || interestPlusInsurance < 0) return;
    try {
      await apiFetch(`/api/loans/${id}/payments`, {
        method: "POST",
        body: JSON.stringify({ totalAmount, interestAmount: interestPlusInsurance, insuranceAmount: 0 }),
      });
      setPaymentTotalInputs((prev) => ({ ...prev, [id]: "" }));
      setPaymentInterestInputs((prev) => ({ ...prev, [id]: "" }));
      await loadLoans();
      await load();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleDeleteLoan(id: string) {
    if (!confirm("Archiver ce prêt ? Il ne comptera plus dans le patrimoine, mais son historique reste consultable dans les prêts archivés.")) return;
    try {
      await apiFetch(`/api/loans/${id}`, { method: "DELETE" });
      await loadLoans();
      await load();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleRestoreLoan(id: string) {
    try {
      await apiFetch(`/api/loans/${id}/restore`, { method: "POST" });
      await loadArchivedLoans();
      await loadLoans();
      await load();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  if (!data.mine) {
    return <p className="text-sm text-slate-500">Rejoins ou crée un foyer pour suivre ton patrimoine.</p>;
  }

  const categoryEntries = Object.entries(data.categories) as [WealthCategory, { label: string; kind: "ASSET" | "LIABILITY" }][];

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <IconBuilding className="h-6 w-6 text-violet-600" />
        Patrimoine
      </h1>
      <div className="card">
        <p className="text-xs text-slate-500">Patrimoine net du foyer</p>
        <p className="mt-1 text-2xl font-semibold">{currency.format(data.householdNetWorth)}</p>
        <p className="mt-1 text-sm text-slate-500">
          Comptes bancaires (perso + joints) + biens et placements déclarés − crédits et dettes déclarés.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="card">
        <h2 className="font-semibold">Mon patrimoine</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StatTile
            icon={IconWallet}
            label="Comptes bancaires (les miens)"
            value={currency.format(data.mine.bankAccountsTotal)}
            color="sky"
          />
          <StatTile
            icon={IconUsers}
            label="Comptes joints du foyer"
            value={currency.format(data.joint.accountsTotal)}
            color="violet"
          />
          <StatTile
            icon={IconArrowsExchange}
            label="Prêts en cours (restant dû)"
            value={`${data.mine.loansTotal > 0 ? "− " : ""}${currency.format(data.mine.loansTotal)}`}
            color="rose"
            tone={data.mine.loansTotal > 0 ? "warn" : "default"}
          />
          <StatTile
            icon={IconChartLine}
            label="Mon solde net (patrimoine déclaré)"
            value={currency.format(data.mine.netWorth)}
            color="emerald"
          />
        </div>
      </section>

      <WealthVariationSection />

      <section className="card">
        <h2 className="font-semibold">Ajouter un bien, placement ou crédit</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            className="input sm:col-span-2"
            placeholder="Libellé (ex. Appartement, Crédit auto)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as WealthCategory)}
          >
            {categoryEntries.map(([key, def]) => (
              <option key={key} value={key}>
                {def.label} {def.kind === "LIABILITY" ? "(dette)" : "(actif)"}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Montant (valeur positive)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={submitting}
          className="mt-3 btn btn-primary"
        >
          {submitting ? "..." : "Ajouter"}
        </button>
      </section>

      <section className="card">
        <h2 className="font-semibold">Mes biens, placements et crédits</h2>
        {data.mine.wealthItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun élément déclaré pour l'instant.</p>
        ) : (
          <ul className="mt-2">
            {data.mine.wealthItems.map((item) => (
              <ValuationRow
                key={item.id}
                item={item}
                categoryLabel={data.categories[item.category].label}
                currency={currency}
                onDelete={handleDelete}
                onUpdated={load}
              />
            ))}
          </ul>
        )}
      </section>

      <DebtCockpitSection />

      <section className="card">
        <h2 className="font-semibold">Prêts en cours</h2>
        <p className="mt-1 text-sm text-slate-500">
          Crédit auto, prêt immobilier, prêt étudiant... suis le capital restant dû et la mensualité de chaque prêt,
          en plus de la dette globale déclarée ci-dessus.
        </p>
        {loanError && <p className="mt-2 text-sm text-red-600">{loanError}</p>}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="input sm:col-span-2"
            placeholder="Libellé (ex. Prêt auto)"
            value={loanLabel}
            onChange={(e) => setLoanLabel(e.target.value)}
          />
          <input
            className="input"
            placeholder="Montant emprunté"
            inputMode="decimal"
            value={loanPrincipal}
            onChange={(e) => setLoanPrincipal(e.target.value)}
          />
          <input
            className="input"
            placeholder="Capital restant dû (optionnel)"
            inputMode="decimal"
            value={loanRemaining}
            onChange={(e) => setLoanRemaining(e.target.value)}
          />
          <input
            className="input"
            placeholder="Mensualité"
            inputMode="decimal"
            value={loanMonthlyPayment}
            onChange={(e) => setLoanMonthlyPayment(e.target.value)}
          />
          <input
            className="input"
            placeholder="Taux annuel % (optionnel)"
            inputMode="decimal"
            value={loanInterestRate}
            onChange={(e) => setLoanInterestRate(e.target.value)}
          />
          <input
            className="input"
            type="month"
            value={loanStartDate}
            onChange={(e) => setLoanStartDate(e.target.value)}
            title="Date de début du prêt"
          />
        </div>
        <button onClick={handleAddLoan} disabled={loanSubmitting} className="mt-3 btn btn-primary">
          {loanSubmitting ? "..." : "Ajouter le prêt"}
        </button>

        {loans && loans.length > 0 && (
          <div className="mt-4 space-y-3">
            {loans.map((loan) => (
              <div key={loan.id} className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {loan.label} {loan.paidOff && <span className="text-emerald-600">✓ remboursé</span>}
                  </h3>
                  <button onClick={() => handleDeleteLoan(loan.id)} className="text-xs text-red-500 underline">
                    Archiver
                  </button>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full ${loan.paidOff ? "bg-emerald-500" : "bg-violet-600"}`}
                    style={{ width: `${Math.round(loan.progressRatio * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Capital restant dû : <span className="font-medium">{currency.format(loan.remainingBalance)}</span> /{" "}
                  {currency.format(loan.principalAmount)} emprunté ({Math.round(loan.progressRatio * 100)}% remboursé)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mensualité {currency.format(loan.monthlyPayment)}
                  {loan.interestRate !== null && <> · taux {loan.interestRate}%</>}
                  {loan.monthsRemaining !== null && !loan.paidOff && (
                    <> · encore environ {loan.monthsRemaining} mois</>
                  )}
                  {loan.projectedPayoffDate && !loan.paidOff && (
                    <> · fin prévue {dateFormat.format(new Date(loan.projectedPayoffDate))}</>
                  )}
                </p>

                {!loan.paidOff && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="w-40 input"
                        placeholder="Mensualité totale (€)"
                        inputMode="decimal"
                        value={paymentTotalInputs[loan.id] ?? ""}
                        onChange={(e) => setPaymentTotalInputs((prev) => ({ ...prev, [loan.id]: e.target.value }))}
                      />
                      <input
                        className="w-48 input"
                        placeholder="dont intérêts + assurance (€)"
                        inputMode="decimal"
                        value={paymentInterestInputs[loan.id] ?? ""}
                        onChange={(e) => setPaymentInterestInputs((prev) => ({ ...prev, [loan.id]: e.target.value }))}
                      />
                      <button onClick={() => handleRecordPayment(loan.id)} className="btn btn-secondary">
                        Enregistrer la mensualité
                      </button>
                    </div>
                    {(() => {
                      const total = Number((paymentTotalInputs[loan.id] ?? "").replace(",", "."));
                      const interest = Number((paymentInterestInputs[loan.id] ?? "0").replace(",", ".") || "0");
                      if (!Number.isFinite(total) || total <= 0) return null;
                      const principal = total - (Number.isFinite(interest) ? interest : 0);
                      return (
                        <p className="mt-1 text-xs text-slate-500">
                          → {currency.format(Math.max(principal, 0))} de capital remboursé
                          {interest > 0 && <> · {currency.format(interest)} consommés (intérêts/assurance)</>}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {loans && loans.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">Aucun prêt en cours déclaré pour l'instant.</p>
        )}

        <button
          onClick={() => {
            const next = !showArchivedLoans;
            setShowArchivedLoans(next);
            if (next && !archivedLoans) loadArchivedLoans();
          }}
          className="mt-4 text-xs link"
        >
          {showArchivedLoans ? "Masquer les prêts archivés" : "Voir les prêts archivés"}
        </button>

        {showArchivedLoans && (
          <div className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs text-slate-500">
              Un prêt archivé ne compte plus dans le patrimoine, mais son historique de remboursement reste
              consultable ici.
            </p>
            {archivedLoans && archivedLoans.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">Aucun prêt archivé.</p>
            )}
            {archivedLoans && archivedLoans.length > 0 && (
              <ul className="mt-2 space-y-2">
                {archivedLoans.map((loan) => (
                  <li key={loan.id} className="flex items-center justify-between text-sm">
                    <span>
                      {loan.label} — {currency.format(loan.remainingBalance)} restant dû au moment de l'archivage
                    </span>
                    <button onClick={() => handleRestoreLoan(loan.id)} className="text-xs link">
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {data.household.length > 0 && (
        <section className="card">
          <h2 className="font-semibold">Reste du foyer</h2>
          <ul className="mt-2">
            {data.household.map((member) => (
              <li key={member.userId} className="border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{member.firstName}</span>
                  <span className="text-sm font-medium">{currency.format(member.netWorth)}</span>
                </div>
                {member.sharesDetails && member.wealthItems && member.wealthItems.length > 0 && (
                  <ul className="mt-1 pl-3">
                    {member.wealthItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {item.label} ({data.categories[item.category].label})
                        </span>
                        <span>
                          {item.kind === "LIABILITY" ? "− " : ""}
                          {currency.format(Number(item.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!member.sharesDetails && (
                  <p className="text-xs text-slate-400">Détail masqué (préférence de confidentialité).</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DebtCockpitSection() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<DebtCockpitResponse | null>(null);

  useEffect(() => {
    apiFetch<DebtCockpitResponse>("/api/loans/cockpit")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data || data.loans.length === 0) return null;

  return (
    <section className="card">
      <h2 className="font-semibold flex items-center gap-2">
        <IconArrowsExchange className="h-5 w-5 text-rose-600" />
        Cockpit dette
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={IconArrowsExchange} label="Dette totale (empruntée)" value={currency.format(data.totalDebt)} color="rose" />
        <StatTile
          icon={IconArrowsExchange}
          label="Capital restant dû"
          value={currency.format(data.totalRemainingBalance)}
          color="rose"
        />
        <StatTile
          icon={IconWallet}
          label="Mensualités cumulées"
          value={currency.format(data.totalMonthlyPayments)}
          color="sky"
        />
      </div>

      <ul className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
          <span>Intérêts restants estimés</span>
          <span>
            {data.totalEstimatedRemainingInterest !== null
              ? currency.format(data.totalEstimatedRemainingInterest)
              : "non disponible (taux manquant sur au moins un prêt)"}
          </span>
        </li>
        {data.incomeShare !== null && (
          <li className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
            <span>Part des revenus consacrée aux crédits</span>
            <span>{Math.round(data.incomeShare * 100)} %</span>
          </li>
        )}
      </ul>

      {data.nextFreedPayment && (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          À partir de {dateFormat.format(new Date(data.nextFreedPayment.endDate))},{" "}
          {currency.format(data.nextFreedPayment.amount)} seront libérés ({data.nextFreedPayment.label}).
        </p>
      )}

      <ul className="mt-3">
        {data.loans.map((l) => (
          <li key={l.id} className="border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
            <p className="text-sm">
              {l.label} : {currency.format(l.monthlyPayment)}/mois
              {l.neverPaysOff ? (
                <span className="text-red-600"> — ne sera jamais remboursé à ce rythme</span>
              ) : (
                l.monthsRemaining !== null && <>, fin prévue dans {l.monthsRemaining} mois</>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WealthVariationSection() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<WealthVariationResponse | null>(null);

  useEffect(() => {
    apiFetch<WealthVariationResponse>("/api/wealth/variation")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <section className="card">
      <h2 className="font-semibold flex items-center gap-2">
        <IconChartLine className="h-5 w-5 text-violet-600" />
        Variation du patrimoine
      </h2>

      {!data.available ? (
        <p className="mt-2 text-sm text-slate-500">{data.reason}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Patrimoine :{" "}
            <span className={`font-semibold ${data.totalVariation! >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {data.totalVariation! >= 0 ? "+" : ""}
              {currency.format(data.totalVariation!)}
            </span>{" "}
            depuis {dateFormat.format(new Date(data.previousMonth!.year, data.previousMonth!.month - 1, 1))}
          </p>
          <ul className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
              <span>Épargne</span>
              <span>{currency.format(data.epargne!)}</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
              <span>Investissement</span>
              <span>{currency.format(data.investissement!)}</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
              <span>Capital immobilier remboursé</span>
              <span>{currency.format(data.capitalRembourse!)}</span>
            </li>
            <li className="flex justify-between py-1">
              <span>Performance des placements et autres variations</span>
              <span>
                {data.unexplained! >= 0 ? "+" : ""}
                {currency.format(data.unexplained!)}
              </span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            La performance des placements ne peut pas être isolée avec certitude sans historique de contribution par
            actif : cette ligne regroupe ce que les flux ci-dessus n'expliquent pas.
          </p>
        </>
      )}
    </section>
  );
}
