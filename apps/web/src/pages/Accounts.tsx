import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { AccountForm } from "../components/AccountForm";
import { useAuth } from "../context/AuthContext";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconWallet } from "../components/icons";
import type {
  AccountEnvelopesResponse,
  BankAccount,
  BankAccountsResponse,
  BankAccountType,
  CheckpointsResponse,
  CreateCheckpointResponse,
} from "../api/types";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function ReconciliationPanel({ accountId }: { accountId: string }) {
  const currency = useCurrencyFormatter();
  const today = new Date();
  const [checkpoints, setCheckpoints] = useState<CheckpointsResponse["checkpoints"] | null>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [statedBalance, setStatedBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateCheckpointResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadCheckpoints() {
    try {
      const res = await apiFetch<CheckpointsResponse>(`/api/bank-accounts/${accountId}/checkpoints`);
      setCheckpoints(res.checkpoints);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'historique des points de contrôle.");
    }
  }

  useEffect(() => {
    loadCheckpoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(statedBalance.replace(",", "."));
    if (!Number.isFinite(amount)) {
      setError("Montant invalide.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<CreateCheckpointResponse>(`/api/bank-accounts/${accountId}/checkpoints`, {
        method: "POST",
        body: JSON.stringify({ year, month, statedBalance: amount }),
      });
      setResult(res);
      setStatedBalance("");
      await loadCheckpoints();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer ce point de contrôle.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
      <p className="font-semibold">Faire le point</p>
      <p className="mt-1 text-xs text-slate-500">
        Indiquez le solde constaté sur votre relevé bancaire. Atlas compare ce solde à celui attendu (solde
        précédent + revenus − dépenses ± transferts) et signale tout écart.
      </p>
      <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Mois</label>
          <select
            className="input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_LABELS.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Année</label>
          <input
            type="number"
            className="input w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Solde constaté (€)</label>
          <input
            type="text"
            inputMode="decimal"
            className="input w-32"
            placeholder="0,00"
            value={statedBalance}
            onChange={(e) => setStatedBalance(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "..." : "Valider"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {result && (
        <div
          className={`mt-3 rounded-lg p-2 text-xs ${
            result.isSignificantDiscrepancy
              ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          <p>Solde attendu : {currency.format(Number(result.checkpoint.expectedBalance ?? 0))}</p>
          {result.isSignificantDiscrepancy ? (
            <p className="font-semibold">
              ⚠️ Écart de rapprochement : {currency.format(Math.abs(Number(result.checkpoint.discrepancy ?? 0)))}{" "}
              {Number(result.checkpoint.discrepancy) > 0 ? "de plus" : "de moins"} que prévu.
            </p>
          ) : (
            <p className="font-semibold">✓ Aucun écart, tout concorde.</p>
          )}
        </div>
      )}

      {checkpoints && checkpoints.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500">Historique</p>
          <ul className="mt-1 space-y-1">
            {checkpoints.map((cp) => {
              const discrepancy = Number(cp.discrepancy ?? 0);
              const significant = Math.abs(discrepancy) > 0.01;
              return (
                <li key={cp.id} className="flex items-center justify-between text-xs">
                  <span>
                    {MONTH_LABELS[cp.month - 1]} {cp.year} — {currency.format(Number(cp.statedBalance))}
                  </span>
                  <span className={significant ? "font-semibold text-amber-700 dark:text-amber-400" : "text-slate-400"}>
                    {significant ? `⚠️ écart ${currency.format(Math.abs(discrepancy))}` : "OK"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function EnvelopesPanel({ accountId }: { accountId: string }) {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<AccountEnvelopesResponse | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<AccountEnvelopesResponse>(`/api/bank-accounts/${accountId}/envelopes`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les enveloppes.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/bank-accounts/${accountId}/envelopes`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), amount: parsed }),
      });
      setName("");
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/bank-accounts/envelopes/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
      <p className="font-semibold">Enveloppes virtuelles</p>
      <p className="mt-1 text-xs text-slate-500">
        Réservez mentalement une partie du solde (sécurité, voyage, voiture...) sans déplacer d'argent. Le total ne
        doit jamais dépasser le solde du compte.
      </p>

      {data && data.envelopes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.envelopes.map((env) => (
            <li key={env.id} className="flex items-center justify-between text-xs">
              <span>{env.name}</span>
              <span className="flex items-center gap-2">
                {currency.format(Number(env.amount))}
                <button onClick={() => handleDelete(env.id)} className="text-slate-400 hover:text-red-600">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {data && (
        <p
          className={`mt-2 text-xs font-semibold ${data.overAllocated ? "text-amber-700 dark:text-amber-400" : "text-slate-500"}`}
        >
          {data.overAllocated
            ? `⚠️ Enveloppes (${currency.format(data.allocated)}) supérieures au solde — dépassement de ${currency.format(Math.abs(data.free))}.`
            : `Libre (hors enveloppes) : ${currency.format(data.free)}`}
        </p>
      )}

      <form onSubmit={handleAdd} className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Nom</label>
          <input
            className="input w-28 px-2 py-1 text-sm"
            placeholder="Ex. Voyage"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Montant (€)</label>
          <input
            className="input w-24 px-2 py-1 text-sm"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting} className="btn btn-primary px-2 py-1 text-xs">
          {submitting ? "..." : "Ajouter"}
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const TYPE_LABELS: Record<BankAccountType, string> = {
  COURANT: "Compte courant",
  LIVRET: "Livret",
  PRO: "Compte pro",
  JOINT: "Compte joint",
  AUTRE: "Autre",
};

// Un dégradé fixe par type de compte (pas de couleur aléatoire) — repère
// visuel constant, dans l'esprit des visuels de carte bancaire des
// références (dégradé plein, chiffres en clair).
const TYPE_GRADIENT: Record<BankAccountType, string> = {
  COURANT: "from-violet-600 to-indigo-500",
  LIVRET: "from-emerald-600 to-teal-500",
  PRO: "from-slate-700 to-slate-500",
  JOINT: "from-pink-600 to-rose-500",
  AUTRE: "from-amber-600 to-orange-500",
};

function AccountCard({ account, onDelete }: { account: BankAccount; onDelete: (id: string) => void }) {
  const currency = useCurrencyFormatter();
  const [reconciling, setReconciling] = useState(false);
  const [envelopesOpen, setEnvelopesOpen] = useState(false);
  return (
    <div>
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm ${TYPE_GRADIENT[account.type]}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">{account.name}</p>
            <p className="text-xs text-white/70">{TYPE_LABELS[account.type]}</p>
          </div>
          <button
            onClick={() => onDelete(account.id)}
            className="rounded-md px-1.5 py-0.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={`Supprimer ${account.name}`}
          >
            Supprimer
          </button>
        </div>
        <p className="mt-5 text-2xl font-bold tracking-tight">{currency.format(Number(account.initialBalance))}</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setReconciling((v) => !v)}
            className="text-xs font-medium text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
          >
            {reconciling ? "Masquer le rapprochement" : "Faire le point"}
          </button>
          <button
            onClick={() => setEnvelopesOpen((v) => !v)}
            className="text-xs font-medium text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
          >
            {envelopesOpen ? "Masquer les enveloppes" : "Enveloppes"}
          </button>
        </div>
      </div>
      {reconciling && <ReconciliationPanel accountId={account.id} />}
      {envelopesOpen && <EnvelopesPanel accountId={account.id} />}
    </div>
  );
}

export function Accounts() {
  const currency = useCurrencyFormatter();
  const { household } = useAuth();
  const [data, setData] = useState<BankAccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [addingJoint, setAddingJoint] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<BankAccountsResponse>("/api/bank-accounts");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les comptes.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(payload: { name: string; type: BankAccountType; initialBalance: number }) {
    await apiFetch("/api/bank-accounts", { method: "POST", body: JSON.stringify(payload) });
    setAddingPersonal(false);
    setAddingJoint(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce compte ? Cette action est définitive.")) return;
    await apiFetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
    await load();
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">Chargement...</p>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconWallet className="h-6 w-6 text-violet-600" />
          Comptes bancaires — {household?.name}
        </h1>
        <p className="text-sm text-slate-500">
          Code d'invitation du foyer : <span className="font-mono font-semibold">{household?.inviteCode}</span>
        </p>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Mes comptes</h2>
          {!addingPersonal && (
            <button
              onClick={() => setAddingPersonal(true)}
              className="text-sm link"
            >
              + Ajouter un compte
            </button>
          )}
        </div>
        {data.mine.length === 0 && !addingPersonal && (
          <p className="mt-2 text-sm text-slate-500">Aucun compte pour l'instant.</p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.mine.map((account) => (
            <AccountCard key={account.id} account={account} onDelete={handleDelete} />
          ))}
        </div>
        {addingPersonal && (
          <AccountForm variant="personal" onSubmit={handleCreate} onCancel={() => setAddingPersonal(false)} />
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Compte(s) joint(s) du foyer</h2>
          {!addingJoint && (
            <button onClick={() => setAddingJoint(true)} className="text-sm link">
              + Ajouter un compte joint
            </button>
          )}
        </div>
        {data.joint.length === 0 && !addingJoint && (
          <p className="mt-2 text-sm text-slate-500">Aucun compte joint pour l'instant.</p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.joint.map((account) => (
            <AccountCard key={account.id} account={account} onDelete={handleDelete} />
          ))}
        </div>
        {addingJoint && (
          <AccountForm variant="joint" onSubmit={handleCreate} onCancel={() => setAddingJoint(false)} />
        )}
      </section>

      {data.household.length > 0 && (
        <section className="card">
          <h2 className="font-semibold">Autres membres du foyer</h2>
          <div className="mt-2 space-y-4">
            {data.household.map((member) => (
              <div key={member.userId}>
                <p className="text-sm font-medium">{member.firstName}</p>
                {member.sharesDetails ? (
                  member.accounts && member.accounts.length > 0 ? (
                    <ul>
                      {member.accounts.map((account) => (
                        <li key={account.id} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1.5 text-sm last:border-0">
                          <span>
                            {account.name} <span className="text-slate-400">({TYPE_LABELS[account.type]})</span>
                          </span>
                          <span className="font-semibold">{currency.format(Number(account.initialBalance))}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Aucun compte.</p>
                  )
                ) : (
                  <p className="text-xs text-slate-500">
                    Détail privé — {member.accountCount} compte(s), total{" "}
                    {currency.format(member.total ?? 0)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
