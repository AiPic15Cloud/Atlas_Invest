import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

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
    <div className="mx-auto mt-16 max-w-md rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="mb-2 text-xl font-semibold">Bienvenue !</h1>
      <p className="mb-6 text-sm text-slate-600">
        Pour commencer, crée ton foyer ou rejoins celui d'un proche grâce à un code d'invitation.
      </p>

      <div className="mb-6 flex rounded-md bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-md py-1.5 ${mode === "create" ? "bg-white shadow-sm" : "text-slate-500"}`}
        >
          Créer un foyer
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-md py-1.5 ${mode === "join" ? "bg-white shadow-sm" : "text-slate-500"}`}
        >
          Rejoindre un foyer
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "create" ? (
          <div>
            <label htmlFor="householdName" className="mb-1 block text-sm font-medium text-slate-700">
              Nom du foyer
            </label>
            <input
              id="householdName"
              required
              placeholder="Ex. Famille Dupont"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium text-slate-700">
              Code d'invitation
            </label>
            <input
              id="inviteCode"
              required
              placeholder="Ex. AB12CD34"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Un instant..." : mode === "create" ? "Créer mon foyer" : "Rejoindre le foyer"}
        </button>
      </form>
    </div>
  );
}
