import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function Settings() {
  const { user, household, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function togglePrivacy() {
    if (!user) return;
    setSavingPrivacy(true);
    setError(null);
    try {
      await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ shareDetailsWithHousehold: !user.shareDetailsWithHousehold }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour ce réglage.");
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function leaveHousehold() {
    if (!confirm("Quitter ce foyer ? Vous devrez d'abord n'avoir aucun compte bancaire personnel.")) return;
    setLeaving(true);
    setError(null);
    try {
      await apiFetch("/api/households/leave", { method: "POST" });
      await refresh();
      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de quitter le foyer.");
    } finally {
      setLeaving(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("Supprimer définitivement votre compte utilisateur ?")) return;
    setError(null);
    try {
      await apiFetch("/api/me", { method: "DELETE" });
      logout();
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer le compte.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Réglages</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Profil</h2>
        <p className="mt-2 text-sm text-slate-600">Prénom : {user?.firstName}</p>
        <p className="text-sm text-slate-600">Email : {user?.email}</p>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Confidentialité</h2>
        <p className="mt-2 text-sm text-slate-600">
          Choisis si le reste de ton foyer voit le détail de tes comptes bancaires personnels, ou seulement
          un total consolidé.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={user?.shareDetailsWithHousehold ?? false}
            onChange={togglePrivacy}
            disabled={savingPrivacy}
          />
          Partager le détail de mes comptes avec mon foyer
        </label>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Foyer</h2>
        <p className="mt-2 text-sm text-slate-600">
          {household?.name} — code d'invitation : <span className="font-mono">{household?.inviteCode}</span>
        </p>
        <button
          onClick={leaveHousehold}
          disabled={leaving}
          className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Quitter le foyer
        </button>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-red-200">
        <h2 className="font-semibold text-red-700">Zone de danger</h2>
        <button
          onClick={deleteAccount}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Supprimer mon compte
        </button>
      </section>
    </div>
  );
}
