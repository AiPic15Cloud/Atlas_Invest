import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconMenu, IconX, IconLogout } from "./icons";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ to: "/", label: "Tableau de bord", icon: "📊" }] },
  {
    title: "Budget",
    items: [
      { to: "/comptes", label: "Comptes", icon: "🏦" },
      { to: "/revenus", label: "Revenus", icon: "💰" },
      { to: "/budget-type", label: "Budget type", icon: "📁" },
      { to: "/budget-du-mois", label: "Budget du mois", icon: "🗓️" },
      { to: "/repartition", label: "Répartition", icon: "🤝" },
    ],
  },
  {
    title: "Épargne & patrimoine",
    items: [
      { to: "/epargne", label: "Épargne", icon: "🛡️" },
      { to: "/objectifs", label: "Objectifs", icon: "🎯" },
      { to: "/patrimoine", label: "Patrimoine", icon: "🏛️" },
      { to: "/economies", label: "Économies", icon: "✂️" },
    ],
  },
  {
    title: "Suivi",
    items: [
      { to: "/abonnements", label: "Abonnements", icon: "🔁" },
      { to: "/echeances", label: "Échéances", icon: "⏰" },
      { to: "/historique", label: "Historique", icon: "🕒" },
    ],
  },
  {
    title: "Outils",
    items: [
      { to: "/export", label: "Export", icon: "📤" },
      { to: "/projection", label: "Projection", icon: "🔮" },
    ],
  },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-pink-50 text-pink-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-base shadow-sm">
          💰
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight text-slate-900">Budget Foyer</p>
          <p className="text-xs text-slate-400">mon budget</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={i}>
            {group.title && (
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass} onClick={onNavigate}>
                  <span className="w-5 shrink-0 text-center text-base leading-none">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-slate-100 px-3 py-3">
        <NavLink to="/settings" className={navLinkClass} onClick={onNavigate}>
          <span className="w-5 shrink-0 text-center text-base leading-none">⚙️</span>
          Réglages
        </NavLink>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {user?.firstName?.[0]?.toUpperCase()}
            </div>
            <span className="truncate text-sm text-slate-600">{user?.firstName}</span>
          </div>
          <button
            onClick={logout}
            title="Déconnexion"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <IconLogout className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white md:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-sm shadow-sm">
            💰
          </div>
          <span className="text-sm font-bold text-slate-900">Budget Foyer</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Ouvrir le menu"
        >
          <IconMenu className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex shrink-0 justify-end px-3 pt-3">
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fermer le menu"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
