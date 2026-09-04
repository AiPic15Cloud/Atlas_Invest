import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, getAuthToken, setAuthToken } from "../api/client";
import type { Household, PublicUser } from "../api/types";

interface AuthContextValue {
  user: PublicUser | null;
  household: Household | null;
  loading: boolean;
  register: (email: string, password: string, firstName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
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

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: PublicUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setHousehold(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, household, loading, register, login, logout, refresh }}>
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
