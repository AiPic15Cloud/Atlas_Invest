import type { ComponentType } from "react";
import type { IconProps } from "./icons";

type Tone = "default" | "good" | "warn";
type Color = "violet" | "emerald" | "rose" | "sky" | "amber";

// La couleur de la puce identifie la nature de la donnée (revenu, dépense,
// solde...) — indépendante du ton, qui juge la performance (bon/mauvais).
// Sans ça, toutes les tuiles ressortaient violettes malgré des sens différents.
const CHIP_CLASS: Record<Color, string> = {
  violet: "bg-copper-100 text-copper-700 dark:bg-copper-500/15 dark:text-copper-300",
  emerald: "bg-olive-100 text-olive-700 dark:bg-olive-500/15 dark:text-olive-300",
  rose: "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-500/15 dark:text-terracotta-300",
  sky: "bg-copper-100 text-copper-700 dark:bg-copper-500/15 dark:text-copper-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

const VALUE_CLASS: Record<Tone, string> = {
  default: "text-[#2b1d14] dark:text-[#f3e9dc]",
  good: "text-olive-600 dark:text-olive-400",
  warn: "text-terracotta-600 dark:text-terracotta-400",
};

const HINT_CLASS: Record<Tone, string> = {
  default: "text-[#8a7358] dark:text-[#a8927a]",
  good: "text-olive-600 dark:text-olive-400",
  warn: "text-terracotta-600 dark:text-terracotta-400",
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
    <div className="rounded-[20px] border border-[#e8dcc9] bg-white p-4 shadow-sm dark:border-[#3a2a1c] dark:bg-[#241a12]">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${CHIP_CLASS[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="stat-label mt-3">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tracking-tight ${VALUE_CLASS[tone]}`}>{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${HINT_CLASS[tone]}`}>{hint}</p>}
    </div>
  );
}
