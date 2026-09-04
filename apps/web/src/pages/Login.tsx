import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { AuthShell } from "../components/AuthShell";

export function Login() {
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        setPendingToken(result.pendingToken);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactorSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await completeTwoFactorLogin(pendingToken, code);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Code incorrect.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingToken) {
    return (
      <AuthShell
        title="Vérification en deux étapes"
        subtitle="Entre le code à 6 chiffres de ton application d'authentification, ou l'un de tes codes de secours."
      >
        <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="label">
              Code
            </label>
            <input
              id="code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input text-center text-lg tracking-[0.3em]"
              placeholder="123456"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? "Vérification..." : "Vérifier"}
          </button>
        </form>
        <button
          onClick={() => {
            setPendingToken(null);
            setCode("");
            setError(null);
          }}
          className="mt-4 text-sm text-slate-500 underline"
        >
          Retour
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Connexion" subtitle="Content de te revoir.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Pas encore de compte ?{" "}
        <Link to="/register" className="link">
          Créer un compte
        </Link>
      </p>
    </AuthShell>
  );
}
