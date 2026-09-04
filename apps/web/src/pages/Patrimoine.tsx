import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { WealthCategory, WealthResponse } from "../api/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function Patrimoine() {
  const [data, setData] = useState<WealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<WealthCategory>("PLACEMENT");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<WealthResponse>("/api/wealth");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le patrimoine.");
    }
  }

  useEffect(() => {
    load();
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
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Comptes bancaires (les miens)</p>
            <p className="text-lg font-medium">{currency.format(data.mine.bankAccountsTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Comptes joints du foyer</p>
            <p className="text-lg font-medium">{currency.format(data.joint.accountsTotal)}</p>
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
