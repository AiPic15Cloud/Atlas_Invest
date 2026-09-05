import { useMemo, useState } from "react";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { DashboardMonth } from "../api/types";

const MONTH_NAMES = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];
const MONTH_NAMES_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const SERIES = [
  { key: "income" as const, label: "Revenu", color: "#10b981" },
  { key: "expense" as const, label: "Dépenses", color: "#ec4899" },
  { key: "reste" as const, label: "Reste", color: "#8b5cf6" },
];

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

interface AnnualLineChartProps {
  monthly: DashboardMonth[];
  selectedIndex: number;
  onSelectMonth: (index: number) => void;
}

export function AnnualLineChart({ monthly, selectedIndex, onSelectMonth }: AnnualLineChartProps) {
  const currency = useCurrencyFormatter({ maximumFractionDigits: 0 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { min, max, ticks } = useMemo(() => {
    const values = monthly.flatMap((m) => [m.income, m.expense, m.reste]);
    const dataMin = Math.min(0, ...values);
    const dataMax = Math.max(0, ...values);
    const t = niceTicks(dataMin, dataMax);
    return { min: t[0], max: t[t.length - 1], ticks: t };
  }, [monthly]);

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (i: number) => PADDING.left + (i / 11) * innerWidth;
  const y = (v: number) => PADDING.top + innerHeight - ((v - min) / (max - min || 1)) * innerHeight;

  function pathFor(key: "income" | "expense" | "reste") {
    return monthly.map((m, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(m[key])}`).join(" ");
  }

  const hovered = hoverIndex !== null ? monthly[hoverIndex] : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <button onClick={() => setShowTable((v) => !v)} className="text-xs font-medium text-slate-900 underline dark:text-slate-100">
          {showTable ? "Voir le graphique" : "Voir en tableau"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1 pr-3">Mois</th>
                <th className="py-1 pr-3">Revenu</th>
                <th className="py-1 pr-3">Dépenses</th>
                <th className="py-1">Reste</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => (
                <tr
                  key={m.month}
                  onClick={() => onSelectMonth(i)}
                  className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 ${i === selectedIndex ? "bg-slate-50 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}
                >
                  <td className="py-1 pr-3 font-medium">{MONTH_NAMES_FULL[m.month - 1]}</td>
                  <td className="py-1 pr-3">{currency.format(m.income)}</td>
                  <td className="py-1 pr-3">{currency.format(m.expense)}</td>
                  <td className="py-1">{currency.format(m.reste)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Revenu, dépenses et reste, par mois">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--chart-grid-zero)" : "var(--chart-grid)"} strokeWidth={1} />
                <text x={PADDING.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--chart-text-muted)">
                  {new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(t)}
                </text>
              </g>
            ))}

            {monthly.map((m, i) => (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={i === selectedIndex ? 700 : 400}
                fill={i === selectedIndex ? "var(--chart-text)" : "var(--chart-text-muted)"}
              >
                {MONTH_NAMES[m.month - 1]}
              </text>
            ))}

            {SERIES.map((s) => (
              <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {SERIES.map((s) => {
              const last = monthly[monthly.length - 1];
              return (
                <g key={`${s.key}-end`}>
                  <circle cx={x(11)} cy={y(last[s.key])} r={4.5} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />
                </g>
              );
            })}

            <line
              x1={x(selectedIndex)}
              x2={x(selectedIndex)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="var(--chart-text)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />

            {hoverIndex !== null && hoverIndex !== selectedIndex && (
              <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="var(--chart-grid-zero)" strokeWidth={1} />
            )}

            {hoverIndex !== null &&
              SERIES.map((s) => (
                <circle
                  key={`${s.key}-hover`}
                  cx={x(hoverIndex)}
                  cy={y(monthly[hoverIndex][s.key])}
                  r={4.5}
                  fill={s.color}
                  stroke="var(--chart-surface)"
                  strokeWidth={2}
                />
              ))}

            {monthly.map((_, i) => (
              <rect
                key={i}
                x={x(i) - innerWidth / 24}
                y={PADDING.top}
                width={innerWidth / 12}
                height={innerHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => onSelectMonth(i)}
              />
            ))}
          </svg>

          {hovered && hoverIndex !== null && (
            <div
              className="pointer-events-none absolute top-2 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800"
              style={{
                left: `${(x(hoverIndex) / WIDTH) * 100}%`,
                transform: `translateX(${(x(hoverIndex) / WIDTH) * 100 > 60 ? "calc(-100% - 10px)" : "10px"})`,
              }}
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {MONTH_NAMES_FULL[monthly[hoverIndex].month - 1]}
              </p>
              <div className="mt-1.5 space-y-1">
                {SERIES.map((s) => {
                  const value = hovered[s.key];
                  const delta = hoverIndex > 0 ? value - monthly[hoverIndex - 1][s.key] : null;
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                        {currency.format(value)}
                        {delta !== null && Math.round(delta) !== 0 && (
                          <span className={delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                            {delta > 0 ? "▲" : "▼"} {currency.format(Math.abs(delta))}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
