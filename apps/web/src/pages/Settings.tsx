import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { TwoFactorSetupResponse, TwoFactorStatus } from "../api/types";

export function Settings() {
  const { user, household, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  async function loadTwoFactorStatus() {
    try {
      const res = await apiFetch<TwoFactorStatus>("/api/2fa/status");
      setTwoFactorStatus(res);
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Impossible de charger le statut 2FA.");
    }
  }

  useEffect(() => {
    loadTwoFactorStatus();
  }, []);

  async function handleStartSetup() {
    setTwoFactorBusy(true);
    setTwoFactorError(null);
    try {
      const res = await apiFetch<TwoFactorSetupResponse>("/api/2fa/setup", { method: "POST" });
      setSetup(res);
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleConfirmSetup() {
    setTwoFactorBusy(true);
    setTwoFactorError(null);
    try {
      const res = await apiFetch<{ backupCodes: string[] }>("/api/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: setupCode }),
      });
      setBackupCodes(res.backupCodes);
      setSetup(null);
      setSetupCode("");
      await loadTwoFactorStatus();
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Code incorrect.");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleDisable() {
    setTwoFactorBusy(true);
    setTwoFactorError(null);
    try {
      await apiFetch("/api/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      setShowDisableForm(false);
      setDisablePassword("");
      setDisableCode("");
      await loadTwoFactorStatus();
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setTwoFactorBusy(false);
    }
  }

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

      <section className="card">
        <h2 className="font-semibold">Profil</h2>
        <p className="mt-2 text-sm text-slate-600">Prénom : {user?.firstName}</p>
        <p className="text-sm text-slate-600">Email : {user?.email}</p>
      </section>

      <section className="card">
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

      <section className="card">
        <h2 className="font-semibold">Double authentification (2FA)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Protège ton compte avec un code généré par une application comme Google Authenticator ou Authy, en plus
          de ton mot de passe.
        </p>
        {twoFactorError && <p className="mt-2 text-sm text-red-600">{twoFactorError}</p>}

        {backupCodes ? (
          <div className="mt-3 rounded-md bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="text-sm font-medium text-amber-800">
              2FA activée ! Note ces codes de secours dans un endroit sûr — chacun ne fonctionne qu'une fois et ils
              ne seront plus jamais affichés.
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm text-amber-900">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button
              onClick={() => setBackupCodes(null)}
              className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              J'ai bien noté mes codes
            </button>
          </div>
        ) : setup ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              Scanne ce QR code avec ton application d'authentification, ou saisis la clé manuellement :{" "}
              <span className="font-mono">{setup.secret}</span>
            </p>
            <img src={setup.qrCodeDataUrl} alt="QR code 2FA" className="h-40 w-40" />
            <div className="flex items-center gap-2">
              <input
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                placeholder="Code à 6 chiffres"
                className="w-40 input"
              />
              <button
                onClick={handleConfirmSetup}
                disabled={twoFactorBusy}
                className="rounded-md bg-pink-600 hover:bg-pink-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Confirmer et activer
              </button>
              <button onClick={() => setSetup(null)} className="text-sm text-slate-500 underline">
                Annuler
              </button>
            </div>
          </div>
        ) : twoFactorStatus?.enabled ? (
          <div className="mt-3">
            <p className="text-sm text-emerald-700">
              ✓ Activée — {twoFactorStatus.remainingBackupCodes} code(s) de secours restant(s).
            </p>
            {!showDisableForm ? (
              <button
                onClick={() => setShowDisableForm(true)}
                className="mt-2 btn btn-outline"
              >
                Désactiver la 2FA
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="block w-full max-w-xs input"
                />
                <input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="Code 2FA ou code de secours"
                  className="block w-full max-w-xs input"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDisable}
                    disabled={twoFactorBusy}
                    className="btn btn-danger disabled:opacity-50"
                  >
                    Confirmer la désactivation
                  </button>
                  <button onClick={() => setShowDisableForm(false)} className="text-sm text-slate-500 underline">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleStartSetup}
            disabled={twoFactorBusy}
            className="mt-3 btn btn-primary"
          >
            Activer la double authentification
          </button>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold">Foyer</h2>
        <p className="mt-2 text-sm text-slate-600">
          {household?.name} — code d'invitation : <span className="font-mono">{household?.inviteCode}</span>
        </p>
        <button
          onClick={leaveHousehold}
          disabled={leaving}
          className="mt-3 btn btn-outline"
        >
          Quitter le foyer
        </button>
      </section>

      <section className="card p-4 ring-red-300">
        <h2 className="font-semibold text-red-700">Zone de danger</h2>
        <button
          onClick={deleteAccount}
          className="mt-3 btn btn-danger"
        >
          Supprimer mon compte
        </button>
      </section>
    </div>
  );
}
