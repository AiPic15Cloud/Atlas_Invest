import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconX,
  IconLogout,
  IconHome,
  IconCalendar,
  IconSliders,
  IconShield,
  IconFlag,
  IconUsers,
  IconBuilding,
  IconWallet,
  IconTrendingUp,
  IconArrowsExchange,
  IconScissors,
  IconRepeat,
  IconClock,
  IconHistory,
  IconDownload,
  IconChartLine,
  IconSettings,
  IconMenu,
  type IconProps,
} from "./icons";

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<IconProps>;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

// Navigation simplifiée à 5-6 destinations : Accueil / Mon mois / Mon plan /
// Projets & Sécurité / Patrimoine / Plus. Revenus et Répartition ne sont plus
// des destinations de premier niveau (Revenus rejoint "Plus", Répartition
// rejoint "Projets & Sécurité"). Icônes d'une seule bibliothèque (trait
// homogène) plutôt que des emojis (direction design "fintech premium",
// spec section 5).
const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ to: "/", label: "Accueil", Icon: IconHome }] },
  { title: null, items: [{ to: "/budget-du-mois", label: "Mon mois", Icon: IconCalendar }] },
  { title: null, items: [{ to: "/budget-type", label: "Mon plan", Icon: IconSliders }] },
  {
    title: "Projets & sécurité",
    items: [
      { to: "/epargne", label: "Épargne de précaution", Icon: IconShield },
      { to: "/objectifs", label: "Objectifs", Icon: IconFlag },
      { to: "/repartition", label: "Répartition des charges", Icon: IconUsers },
    ],
  },
  { title: null, items: [{ to: "/patrimoine", label: "Patrimoine", Icon: IconBuilding }] },
  {
    title: "Plus",
    items: [
      { to: "/comptes", label: "Comptes", Icon: IconWallet },
      { to: "/revenus", label: "Revenus", Icon: IconTrendingUp },
      { to: "/transferts", label: "Transferts", Icon: IconArrowsExchange },
      { to: "/economies", label: "Économies", Icon: IconScissors },
      { to: "/abonnements", label: "Abonnements", Icon: IconRepeat },
      { to: "/echeances", label: "Échéances", Icon: IconClock },
      { to: "/historique", label: "Historique", Icon: IconHistory },
      { to: "/export", label: "Export", Icon: IconDownload },
      { to: "/projection", label: "Projection", Icon: IconChartLine },
    ],
  },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

// Navigation mobile principale : 3 pages du quotidien accessibles en un tap
// depuis une pastille flottante, plus un bouton "Plus" qui ouvre le même
// tiroir complet que l'ancien bouton menu de la barre du haut (désormais
// retiré de la barre du haut, qui ne garde que la marque). Une seule couleur
// d'accent (violet, la couleur principale de la palette) plutôt qu'une
// couleur différente par onglet — direction "fintech premium" (spec
// section 5) : une couleur principale, une secondaire, puis des couleurs
// strictement fonctionnelles (jamais une couleur par simple décoration).
const MOBILE_TABS = [
  { to: "/", label: "Accueil", Icon: IconHome },
  { to: "/budget-du-mois", label: "Mon mois", Icon: IconCalendar },
  { to: "/budget-type", label: "Mon plan", Icon: IconSliders },
] as const;

function mobileTabClass(isActive: boolean) {
  return `flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] transition-colors ${
    isActive ? "text-violet-600 font-semibold" : "font-medium text-slate-400"
  }`;
}

function MobileTabBar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  return (
    <nav className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-full border border-slate-200 bg-white/85 px-2 py-2 shadow-2xl backdrop-blur-xl md:hidden">
      {MOBILE_TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className="flex-1">
          {({ isActive }) => (
            <span className={mobileTabClass(isActive)}>
              <tab.Icon className="h-5 w-5" />
              {tab.label}
            </span>
          )}
        </NavLink>
      ))}
      <button onClick={onOpenMenu} className="flex-1" aria-label="Ouvrir le menu">
        <span className={mobileTabClass(menuOpen)}>
          <IconMenu className="h-5 w-5" />
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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-sm">
          <IconTrendingUp className="h-5 w-5 text-white" />
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
                  <item.Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-slate-100 px-3 py-3">
        <NavLink to="/settings" className={navLinkClass} onClick={onNavigate}>
          <IconSettings className="h-5 w-5 shrink-0" />
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
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 shadow-sm">
          <IconTrendingUp className="h-4 w-4 text-white" />
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
