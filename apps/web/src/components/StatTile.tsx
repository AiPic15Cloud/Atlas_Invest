import type { ComponentType } from "react";
import type { IconProps } from "./icons";

type Tone = "default" | "good" | "warn";
type Color = "violet" | "emerald" | "rose" | "sky" | "amber";

// La couleur de la puce identifie la nature de la donnée (revenu, dépense,
// solde...) — indépendante du ton, qui juge la performance (bon/mauvais).
// Sans ça, toutes les tuiles ressortaient violettes malgré des sens différents.
const CHIP_CLASS: Record<Color, string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
};

const VALUE_CLASS: Record<Tone, string> = {
  default: "text-slate-900 dark:text-slate-100",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-red-600 dark:text-red-400",
};

const HINT_CLASS: Record<Tone, string> = {
  default: "text-slate-500 dark:text-slate-400",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-red-600 dark:text-red-400",
};

interface StatTileProps {
  icon: ComponentType<IconProps>;
  label: string;
  value: string;
  color?: Color;
  tone?: Tone;
  hint?: string;
}

// Tuile avec puce d'icône teintée (spec design fintech premium), plutôt
// qu'un simple aplat de fond — icône et tonalité (violet/vert/rouge)
// donnent un repère visuel avant même de lire le chiffre.
export function StatTile({ icon: Icon, label, value, color = "violet", tone = "default", hint }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${CHIP_CLASS[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="stat-label mt-3">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tracking-tight ${VALUE_CLASS[tone]}`}>{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${HINT_CLASS[tone]}`}>{hint}</p>}
    </div>
  );
}
