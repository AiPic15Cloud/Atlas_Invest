import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { AccountForm } from "../components/AccountForm";
import { useAuth } from "../context/AuthContext";
import type { BankAccount, BankAccountsResponse, BankAccountType } from "../api/types";

const TYPE_LABELS: Record<BankAccountType, string> = {
  COURANT: "Compte courant",
  LIVRET: "Livret",
  PRO: "Compte pro",
  JOINT: "Compte joint",
  AUTRE: "Autre",
};

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function AccountRow({ account, onDelete }: { account: BankAccount; onDelete: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">{account.name}</p>
        <p className="text-xs text-slate-500">{TYPE_LABELS[account.type]}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{currency.format(Number(account.initialBalance))}</span>
        <button
          onClick={() => onDelete(account.id)}
          className="text-xs text-slate-400 hover:text-red-600"
          aria-label={`Supprimer ${account.name}`}
        >
          Supprimer
        </button>
      </div>
    </li>
  );
}

export function Accounts() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Comptes bancaires — {household?.name}</h1>
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
        <ul className="mt-2">
          {data.mine.map((account) => (
            <AccountRow key={account.id} account={account} onDelete={handleDelete} />
          ))}
        </ul>
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
        <ul className="mt-2">
          {data.joint.map((account) => (
            <AccountRow key={account.id} account={account} onDelete={handleDelete} />
          ))}
        </ul>
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
                        <li key={account.id} className="flex justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
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
