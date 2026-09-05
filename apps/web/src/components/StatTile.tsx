import type { ComponentType } from "react";
import type { IconProps } from "./icons";

type Tone = "default" | "good" | "warn";

const CHIP_CLASS: Record<Tone, string> = {
  default: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  good: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  warn: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
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
  tone?: Tone;
  hint?: string;
}

// Tuile avec puce d'icône teintée (spec design fintech premium), plutôt
// qu'un simple aplat de fond — icône et tonalité (violet/vert/rouge)
// donnent un repère visuel avant même de lire le chiffre.
export function StatTile({ icon: Icon, label, value, tone = "default", hint }: StatTileProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${CHIP_CLASS[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="stat-label mt-2.5">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tracking-tight ${VALUE_CLASS[tone]}`}>{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${HINT_CLASS[tone]}`}>{hint}</p>}
    </div>
  );
}
