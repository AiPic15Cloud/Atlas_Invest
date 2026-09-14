import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, type ThemePreference } from "../context/ThemeContext";
import { IconSettings, IconSun, IconMoon, IconMonitor } from "../components/icons";
import type {
  BankAccountsResponse,
  CreatePersonalAccessTokenResponse,
  ExpenseCategory,
  HouseholdCurrency,
  PersonalAccessTokenSummary,
  PersonalAccessTokensResponse,
  TwoFactorSetupResponse,
  TwoFactorStatus,
} from "../api/types";

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof IconSun }[] = [
  { value: "light", label: "Clair", Icon: IconSun },
  { value: "dark", label: "Sombre", Icon: IconMoon },
  { value: "system", label: "Système", Icon: IconMonitor },
];

const CURRENCY_LABELS: Record<HouseholdCurrency, string> = {
  EUR: "€ Euro",
  USD: "$ Dollar américain",
  GBP: "£ Livre sterling",
  CHF: "CHF Franc suisse",
  CAD: "$ Dollar canadien",
};

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  BESOINS: "Besoins",
  ENVIES: "Envies",
  EPARGNE: "Épargne",
  INVESTISSEMENT: "Investissement",
  REMBOURSEMENT_DETTE: "Remboursement de dette",
};

export function Settings() {
  const { user, household, refresh, logout } = useAuth();
  const { theme, setTheme } = useTheme();
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

  const [savingHouseholdSettings, setSavingHouseholdSettings] = useState(false);
  const [resetConfirmName, setResetConfirmName] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<BankAccountsResponse | null>(null);
  const [tokens, setTokens] = useState<PersonalAccessTokenSummary[] | null>(null);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenAccountId, setTokenAccountId] = useState("");
  const [tokenPoste, setTokenPoste] = useState("");
  const [tokenCategory, setTokenCategory] = useState<ExpenseCategory>("BESOINS");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [justCreatedToken, setJustCreatedToken] = useState<string | null>(null);

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
    loadAccounts();
    loadTokens();
  }, []);

  async function loadAccounts() {
    const res = await apiFetch<BankAccountsResponse>("/api/bank-accounts");
    setAccounts(res);
    setTokenAccountId((current) => current || res.mine[0]?.id || res.joint[0]?.id || "");
  }

  async function loadTokens() {
    const res = await apiFetch<PersonalAccessTokensResponse>("/api/personal-tokens");
    setTokens(res.tokens);
  }

  async function createToken() {
    setTokenError(null);
    if (!tokenLabel.trim() || !tokenAccountId || !tokenPoste.trim()) {
      setTokenError("Remplis le libellé, le compte et le poste par défaut.");
      return;
    }
    setTokenBusy(true);
    try {
      const res = await apiFetch<CreatePersonalAccessTokenResponse>("/api/personal-tokens", {
        method: "POST",
        body: JSON.stringify({
          label: tokenLabel.trim(),
          bankAccountId: tokenAccountId,
          defaultPoste: tokenPoste.trim(),
          defaultCategory: tokenCategory,
        }),
      });
      setJustCreatedToken(res.token);
      setTokenLabel("");
      setTokenPoste("");
      setShowTokenForm(false);
      await loadTokens();
    } catch (err) {
      setTokenError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken(id: string) {
    if (!confirm("Révoquer ce jeton ? Le Raccourci qui l'utilise cessera de fonctionner immédiatement.")) return;
    await apiFetch(`/api/personal-tokens/${id}`, { method: "DELETE" });
    await loadTokens();
  }

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

  async function updateHouseholdSettings(patch: { currency?: HouseholdCurrency; fiscalYearStartMonth?: number }) {
    setSavingHouseholdSettings(true);
    setError(null);
    try {
      await apiFetch("/api/households/settings", { method: "PATCH", body: JSON.stringify(patch) });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour ce réglage.");
    } finally {
      setSavingHouseholdSettings(false);
    }
  }

  async function resetHouseholdData() {
    if (!household) return;
    if (resetConfirmName !== household.name) {
      setResetError("Le nom saisi ne correspond pas au nom du foyer.");
      return;
    }
    if (!confirm("Réinitialiser toutes les données du foyer ? Cette action est irréversible.")) return;
    setResetting(true);
    setResetError(null);
    try {
      await apiFetch("/api/households/reset", { method: "POST", body: JSON.stringify({ confirmName: resetConfirmName }) });
      setResetConfirmName("");
      navigate("/dashboard");
      window.location.reload();
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Impossible de réinitialiser les données.");
    } finally {
      setResetting(false);
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
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <IconSettings className="h-6 w-6 text-violet-600" />
        Réglages
      </h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="card">
        <h2 className="font-semibold">Profil</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Prénom : {user?.firstName}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">Email : {user?.email}</p>
      </section>

      <section className="card">
        <h2 className="font-semibold">Apparence</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Choisis le thème de l'application.</p>
        <div className="mt-3 inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 dark:bg-slate-800">
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                theme === value
                  ? "bg-white dark:bg-slate-900 text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold">Confidentialité</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
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
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Protège ton compte avec un code généré par une application comme Google Authenticator ou Authy, en plus
          de ton mot de passe.
        </p>
        {twoFactorError && <p className="mt-2 text-sm text-red-600">{twoFactorError}</p>}

        {backupCodes ? (
          <div className="mt-3 rounded-md bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
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
            <p className="text-sm text-slate-600 dark:text-slate-400">
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
                className="rounded-md bg-violet-600 hover:bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
        <h2 className="font-semibold">Raccourci de saisie rapide</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Crée un jeton d'accès pour logger une dépense en 1 tap depuis un Raccourci iOS, sans ouvrir l'app — utile
          juste après un paiement (Apple Pay ou autre). Le jeton ne peut faire qu'une seule chose : ajouter une
          dépense sur le compte, le poste et la catégorie choisis ici (jamais un accès complet à ton compte).
        </p>

        {tokenError && <p className="mt-2 text-sm text-red-600">{tokenError}</p>}

        {justCreatedToken && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Jeton créé — copie-le maintenant, il ne sera plus jamais affiché :
            </p>
            <p className="mt-2 break-all rounded bg-white dark:bg-slate-900 p-2 font-mono text-xs">{justCreatedToken}</p>
            <button
              onClick={() => setJustCreatedToken(null)}
              className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              J'ai bien copié mon jeton
            </button>
          </div>
        )}

        {tokens && tokens.filter((t) => !t.revokedAt).length > 0 && (
          <ul className="mt-3 space-y-2">
            {tokens.filter((t) => !t.revokedAt).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-2 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-slate-500">
                    {t.bankAccountName} · {t.defaultPoste} · {CATEGORY_LABELS[t.defaultCategory]}
                    {t.lastUsedAt ? ` · dernier usage le ${new Date(t.lastUsedAt).toLocaleDateString("fr-FR")}` : " · jamais utilisé"}
                  </p>
                </div>
                <button onClick={() => revokeToken(t.id)} className="text-xs text-slate-400 hover:text-red-600">
                  Révoquer
                </button>
              </li>
            ))}
          </ul>
        )}

        {!showTokenForm ? (
          <button onClick={() => setShowTokenForm(true)} className="mt-3 btn btn-outline">
            + Créer un jeton
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Libellé (ex. "iPhone — Apple Pay")
              </label>
              <input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} className="w-full input px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Compte bancaire</label>
              <select
                value={tokenAccountId}
                onChange={(e) => setTokenAccountId(e.target.value)}
                className="w-full input px-3 py-1.5 text-sm"
              >
                {[...(accounts?.mine ?? []), ...(accounts?.joint ?? [])].map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Poste par défaut</label>
              <input
                value={tokenPoste}
                onChange={(e) => setTokenPoste(e.target.value)}
                placeholder="Ex. Achats Apple Pay"
                className="w-full input px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Catégorie par défaut</label>
              <select
                value={tokenCategory}
                onChange={(e) => setTokenCategory(e.target.value as ExpenseCategory)}
                className="w-full input px-3 py-1.5 text-sm"
              >
                {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={createToken} disabled={tokenBusy} className="btn btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                {tokenBusy ? "Création..." : "Créer"}
              </button>
              <button
                onClick={() => setShowTokenForm(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <details className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            Comment configurer le Raccourci iOS ?
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Ouvre l'app Raccourcis → crée un nouveau raccourci.</li>
            <li>Ajoute l'action « Demander du texte » avec l'invite « Combien ? ».</li>
            <li>
              Ajoute l'action « Obtenir le contenu de l'URL » : méthode <span className="font-mono">POST</span>, en-tête{" "}
              <span className="font-mono">Authorization: Bearer &lt;ton jeton&gt;</span>, corps JSON{" "}
              <span className="font-mono">{"{\"amount\": <texte demandé>}"}</span>, vers l'adresse de l'API de l'app suivie
              de <span className="font-mono">/api/quick-expense</span>.
            </li>
            <li>
              Épingle ce raccourci à l'écran verrouillé, au bouton Action, ou au tapotement arrière (Réglages →
              Accessibilité → Tape arrière) pour le lancer en un geste juste après un paiement.
            </li>
          </ol>
          <p className="mt-2">
            iOS n'expose pas de déclenchement automatique sur un paiement Apple Pay (Apple ne partage pas cette
            donnée avec les Raccourcis) : ce raccourci se lance manuellement, mais en une seule question.
          </p>
        </details>
      </section>

      <section className="card">
        <h2 className="font-semibold">Foyer</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
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

      {household && (
        <section className="card">
          <h2 className="font-semibold">Réglages du foyer</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Devise</span>
              <select
                className="mt-1 w-full input"
                value={household.currency}
                disabled={savingHouseholdSettings}
                onChange={(e) => updateHouseholdSettings({ currency: e.target.value as HouseholdCurrency })}
              >
                {(Object.entries(CURRENCY_LABELS) as [HouseholdCurrency, string][]).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Mois de début d'année</span>
              <select
                className="mt-1 w-full input"
                value={household.fiscalYearStartMonth}
                disabled={savingHouseholdSettings}
                onChange={(e) => updateHouseholdSettings({ fiscalYearStartMonth: Number(e.target.value) })}
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Le mois de début d'année ne s'applique qu'à la fenêtre de 12 mois affichée sur le tableau de bord ;
            tes données restent classées par mois calendaire.
          </p>
        </section>
      )}

      <section className="card p-4 ring-red-300">
        <h2 className="font-semibold text-red-700">Zone de danger</h2>
        <button
          onClick={deleteAccount}
          className="mt-3 btn btn-danger"
        >
          Supprimer mon compte
        </button>
      </section>

      {household && (
        <section className="card p-4 ring-red-300">
          <h2 className="font-semibold text-red-700">Réinitialiser les données du foyer</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Supprime définitivement toutes les dépenses, revenus, budget type, patrimoine, prêts, objectifs,
            abonnements et l'épargne de précaution du foyer. Le foyer, ses membres et leurs comptes bancaires sont
            conservés. Pour confirmer, saisis le nom exact du foyer : <span className="font-mono">{household.name}</span>.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={resetConfirmName}
              onChange={(e) => setResetConfirmName(e.target.value)}
              placeholder={household.name}
              className="w-56 input"
            />
            <button
              onClick={resetHouseholdData}
              disabled={resetting || resetConfirmName !== household.name}
              className="btn btn-danger disabled:opacity-50"
            >
              {resetting ? "..." : "Réinitialiser les données"}
            </button>
          </div>
          {resetError && <p className="mt-2 text-xs text-red-600">{resetError}</p>}
        </section>
      )}
    </div>
  );
}
