import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Onboarding } from "./pages/Onboarding";
import { Accounts } from "./pages/Accounts";
import { Revenus } from "./pages/Revenus";
import { BudgetType } from "./pages/BudgetType";
import { BudgetDuMois } from "./pages/BudgetDuMois";
import { Settings } from "./pages/Settings";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireHousehold({ children }: { children: ReactNode }) {
  const { household, loading } = useAuth();
  if (loading) return null;
  if (!household) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, household, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={!loading && user ? <Navigate to="/" replace /> : <Register />}
      />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            {household ? <Navigate to="/" replace /> : <Onboarding />}
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <RequireHousehold>
              <Layout />
            </RequireHousehold>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Accounts />} />
        <Route path="/revenus" element={<Revenus />} />
        <Route path="/budget-type" element={<BudgetType />} />
        <Route path="/budget-du-mois" element={<BudgetDuMois />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
