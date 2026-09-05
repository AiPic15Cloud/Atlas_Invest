import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { Loan, LoansResponse, WealthCategory, WealthResponse } from "../api/types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

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
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

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
    const raw = paymentInputs[id];
    const amountPaid = Number((raw ?? "").replace(",", "."));
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) return;
    try {
      await apiFetch(`/api/loans/${id}/record-payment`, { method: "POST", body: JSON.stringify({ amount: amountPaid }) });
      setPaymentInputs((prev) => ({ ...prev, [id]: "" }));
      await loadLoans();
      await load();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleDeleteLoan(id: string) {
    if (!confirm("Supprimer ce prêt ?")) return;
    try {
      await apiFetch(`/api/loans/${id}`, { method: "DELETE" });
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
    <div className="space-y-6">
      <h1 className="page-title">🏛️ Patrimoine</h1>
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
          <div>
            <p className="text-xs text-slate-500">Comptes bancaires (les miens)</p>
            <p className="text-lg font-medium">{currency.format(data.mine.bankAccountsTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Comptes joints du foyer</p>
            <p className="text-lg font-medium">{currency.format(data.joint.accountsTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Prêts en cours (restant dû)</p>
            <p className="text-lg font-medium text-red-600">
              {data.mine.loansTotal > 0 ? "− " : ""}
              {currency.format(data.mine.loansTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Mon solde net (patrimoine déclaré)</p>
            <p className="text-lg font-medium">{currency.format(data.mine.netWorth)}</p>
          </div>
        </div>
      </section>

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
              <li key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm">
                  {item.label}{" "}
                  <span className="text-slate-400">({data.categories[item.category].label})</span>
                </span>
                <span className={`text-sm font-medium ${item.kind === "LIABILITY" ? "text-red-600" : ""}`}>
                  {item.kind === "LIABILITY" ? "− " : ""}
                  {currency.format(Number(item.amount))}
                </span>
                <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 underline">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold">💳 Prêts en cours</h2>
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
              <div key={loan.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {loan.label} {loan.paidOff && <span className="text-emerald-600">✓ remboursé</span>}
                  </h3>
                  <button onClick={() => handleDeleteLoan(loan.id)} className="text-xs text-red-500 underline">
                    Supprimer
                  </button>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${loan.paidOff ? "bg-emerald-500" : "bg-violet-600"}`}
                    style={{ width: `${Math.round(loan.progressRatio * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-sm text-slate-600">
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
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      className="w-40 input"
                      placeholder="Remboursement (€)"
                      inputMode="decimal"
                      value={paymentInputs[loan.id] ?? ""}
                      onChange={(e) => setPaymentInputs((prev) => ({ ...prev, [loan.id]: e.target.value }))}
                    />
                    <button onClick={() => handleRecordPayment(loan.id)} className="btn btn-secondary">
                      Enregistrer un remboursement
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {loans && loans.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">Aucun prêt en cours déclaré pour l'instant.</p>
        )}
      </section>

      {data.household.length > 0 && (
        <section className="card">
          <h2 className="font-semibold">Reste du foyer</h2>
          <ul className="mt-2">
            {data.household.map((member) => (
              <li key={member.userId} className="border-b border-slate-100 py-2 last:border-0">
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
