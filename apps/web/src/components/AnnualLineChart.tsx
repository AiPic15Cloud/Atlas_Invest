import { useMemo, useState } from "react";
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
  { key: "income" as const, label: "Revenu", color: "#2a78d6" },
  { key: "expense" as const, label: "Dépenses", color: "#eb6834" },
  { key: "reste" as const, label: "Reste", color: "#1baf7a" },
];

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

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

export function AnnualLineChart({ monthly }: { monthly: DashboardMonth[] }) {
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
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <button onClick={() => setShowTable((v) => !v)} className="text-xs font-medium text-slate-900 underline">
          {showTable ? "Voir le graphique" : "Voir en tableau"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-3">Mois</th>
                <th className="py-1 pr-3">Revenu</th>
                <th className="py-1 pr-3">Dépenses</th>
                <th className="py-1">Reste</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => (
                <tr key={m.month} className="border-t border-slate-100">
                  <td className="py-1 pr-3 font-medium">{MONTH_NAMES_FULL[i]}</td>
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
                <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
                <text x={PADDING.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#898781">
                  {new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(t)}
                </text>
              </g>
            ))}

            {monthly.map((_, i) => (
              <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="#898781">
                {MONTH_NAMES[i]}
              </text>
            ))}

            {SERIES.map((s) => (
              <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {SERIES.map((s) => {
              const last = monthly[monthly.length - 1];
              return (
                <g key={`${s.key}-end`}>
                  <circle cx={x(11)} cy={y(last[s.key])} r={4.5} fill={s.color} stroke="#fcfcfb" strokeWidth={2} />
                </g>
              );
            })}

            {hoverIndex !== null && (
              <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="#c3c2b7" strokeWidth={1} />
            )}

            {monthly.map((_, i) => (
              <rect
                key={i}
                x={x(i) - innerWidth / 24}
                y={PADDING.top}
                width={innerWidth / 12}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            ))}
          </svg>

          {hovered && hoverIndex !== null && (
            <div
              className="pointer-events-none absolute top-2 rounded-md bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: `min(${(x(hoverIndex) / WIDTH) * 100}%, 78%)` }}
            >
              <p className="font-medium">{MONTH_NAMES_FULL[hoverIndex]}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label} : {currency.format(hovered[s.key])}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
