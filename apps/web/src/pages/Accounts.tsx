import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { AccountForm } from "../components/AccountForm";
import { useAuth } from "../context/AuthContext";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import { IconWallet } from "../components/icons";
import type { BankAccount, BankAccountsResponse, BankAccountType } from "../api/types";

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
  return (
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
