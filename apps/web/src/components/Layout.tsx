import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconX, IconLogout } from "./icons";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

// Navigation simplifiée à 5-6 destinations : Accueil / Mon mois / Mon plan /
// Projets & Sécurité / Patrimoine / Plus. Revenus et Répartition ne sont plus
// des destinations de premier niveau (Revenus rejoint "Plus", Répartition
// rejoint "Projets & Sécurité").
const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ to: "/", label: "Accueil", icon: "🏠" }] },
  { title: null, items: [{ to: "/budget-du-mois", label: "Mon mois", icon: "📅" }] },
  { title: null, items: [{ to: "/budget-type", label: "Mon plan", icon: "🧭" }] },
  {
    title: "Projets & sécurité",
    items: [
      { to: "/epargne", label: "Épargne de précaution", icon: "🛡️" },
      { to: "/objectifs", label: "Objectifs", icon: "🎯" },
      { to: "/repartition", label: "Répartition des charges", icon: "🤝" },
    ],
  },
  { title: null, items: [{ to: "/patrimoine", label: "Patrimoine", icon: "🏛️" }] },
  {
    title: "Plus",
    items: [
      { to: "/comptes", label: "Comptes", icon: "🏦" },
      { to: "/revenus", label: "Revenus", icon: "💰" },
      { to: "/economies", label: "Économies", icon: "✂️" },
      { to: "/abonnements", label: "Abonnements", icon: "🔁" },
      { to: "/echeances", label: "Échéances", icon: "⏰" },
      { to: "/historique", label: "Historique", icon: "🕒" },
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

// Navigation mobile principale : 3 pages du quotidien accessibles en un tap
// depuis une pastille flottante, plus un bouton "Plus" qui ouvre le même
// tiroir complet que l'ancien bouton menu de la barre du haut (désormais
// retiré de la barre du haut, qui ne garde que la marque). Chaque onglet a
// sa propre couleur d'accent plutôt qu'un simple surlignage uniforme.
const MOBILE_TABS = [
  { to: "/", label: "Accueil", icon: "🏠", activeClass: "text-pink-600" },
  { to: "/budget-du-mois", label: "Mon mois", icon: "📅", activeClass: "text-amber-600" },
  { to: "/budget-type", label: "Mon plan", icon: "🧭", activeClass: "text-violet-600" },
] as const;

function mobileTabClass(isActive: boolean, activeClass: string) {
  return `flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] transition-colors ${
    isActive ? `${activeClass} font-semibold` : "font-medium text-slate-400"
  }`;
}

function MobileTabBar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  return (
    <nav className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-full border border-slate-200 bg-white/85 px-2 py-2 shadow-2xl backdrop-blur-xl md:hidden">
      {MOBILE_TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className="flex-1">
          {({ isActive }) => (
            <span className={mobileTabClass(isActive, tab.activeClass)}>
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </span>
          )}
        </NavLink>
      ))}
      <button onClick={onOpenMenu} className="flex-1" aria-label="Ouvrir le menu">
        <span className={mobileTabClass(menuOpen, "text-slate-700")}>
          <span className="text-lg leading-none">☰</span>
          Plus
        </span>
      </button>
    </nav>
  );
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
          <p className="text-base font-bold tracking-tight text-slate-900">Atlas Invest</p>
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
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-sm shadow-sm">
          💰
        </div>
        <span className="text-sm font-bold text-slate-900">Atlas Invest</span>
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
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      <MobileTabBar onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} />
    </div>
  );
}
