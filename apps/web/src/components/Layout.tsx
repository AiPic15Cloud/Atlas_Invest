import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">Budget Foyer</span>
          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={linkClass}>
              Comptes
            </NavLink>
            <NavLink to="/revenus" className={linkClass}>
              Revenus
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Réglages
            </NavLink>
            <span className="ml-2 text-sm text-slate-500">{user?.firstName}</span>
            <button
              onClick={logout}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
            >
              Déconnexion
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
