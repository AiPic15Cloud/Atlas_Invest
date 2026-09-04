import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/AuthShell";

export function Onboarding() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await apiFetch("/api/households", { method: "POST", body: JSON.stringify({ name }) });
      } else {
        await apiFetch("/api/households/join", {
          method: "POST",
          body: JSON.stringify({ inviteCode }),
        });
      }
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Bienvenue !"
      subtitle="Pour commencer, crée ton foyer ou rejoins celui d'un proche grâce à un code d'invitation."
      maxWidth="max-w-md"
    >
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            mode === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Créer un foyer
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            mode === "join" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Rejoindre un foyer
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "create" ? (
          <div>
            <label htmlFor="householdName" className="label">
              Nom du foyer
            </label>
            <input
              id="householdName"
              required
              placeholder="Ex. Famille Dupont"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="inviteCode" className="label">
              Code d'invitation
            </label>
            <input
              id="inviteCode"
              required
              placeholder="Ex. AB12CD34"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="input uppercase tracking-widest"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Un instant..." : mode === "create" ? "Créer mon foyer" : "Rejoindre le foyer"}
        </button>
      </form>
    </AuthShell>
  );
}
