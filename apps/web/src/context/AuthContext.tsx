import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, getAuthToken, setAuthToken } from "../api/client";
import type { Household, PublicUser } from "../api/types";

export type LoginResult = { requiresTwoFactor: false } | { requiresTwoFactor: true; pendingToken: string };

interface AuthContextValue {
  user: PublicUser | null;
  household: Household | null;
  loading: boolean;
  register: (email: string, password: string, firstName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeTwoFactorLogin: (pendingToken: string, code: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setHousehold(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ user: PublicUser; household: Household | null }>("/api/me");
      setUser(data.user);
      setHousehold(data.household);
    } catch {
      setAuthToken(null);
      setUser(null);
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = useCallback(
    async (email: string, password: string, firstName: string) => {
      const data = await apiFetch<{ token: string; user: PublicUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName }),
      });
      setAuthToken(data.token);
      setUser(data.user);
      setHousehold(null);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const data = await apiFetch<
        { token: string; user: PublicUser } | { requiresTwoFactor: true; pendingToken: string }
      >("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if ("requiresTwoFactor" in data && data.requiresTwoFactor) {
        return { requiresTwoFactor: true, pendingToken: data.pendingToken };
      }
      setAuthToken((data as { token: string }).token);
      await refresh();
      return { requiresTwoFactor: false };
    },
    [refresh],
  );

  const completeTwoFactorLogin = useCallback(
    async (pendingToken: string, code: string) => {
      const data = await apiFetch<{ token: string; user: PublicUser }>("/api/auth/2fa-login", {
        method: "POST",
        body: JSON.stringify({ pendingToken, code }),
      });
      setAuthToken(data.token);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setHousehold(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, household, loading, register, login, completeTwoFactorLogin, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
