import { useMemo, useState } from "react";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";

interface WaterfallStep {
  label: string;
  amount: number;
  color: string;
  isTotal?: boolean;
}

interface WaterfallChartProps {
  income: number;
  besoins: number;
  envies: number;
  epargne: number;
  autres: number;
}

const WIDTH = 640;
const HEIGHT = 240;
const PADDING = { top: 24, right: 12, bottom: 28, left: 12 };
const BAR_GAP = 2;

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max; v += step) ticks.push(Math.round(v));
  if (!ticks.includes(0) && min <= 0 && max >= 0) ticks.push(0);
  return ticks.sort((a, b) => a - b);
}

// Un waterfall montre où va chaque euro de revenu (spec 5 : "graphique
// waterfall plutôt que donut") plutôt qu'une simple répartition des
// dépenses déjà faites, qui ne dit rien du revenu ni du reste à vivre.
export function WaterfallChart({ income, besoins, envies, epargne, autres }: WaterfallChartProps) {
  const currency = useCurrencyFormatter({ maximumFractionDigits: 0 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const steps = useMemo<WaterfallStep[]>(() => {
    const reste = income - besoins - envies - epargne - autres;
    const list: WaterfallStep[] = [
      { label: "Revenu", amount: income, color: "#10b981", isTotal: true },
      { label: "Besoins", amount: -besoins, color: "#f59e0b" },
      { label: "Envies", amount: -envies, color: "#ec4899" },
      { label: "Épargne", amount: -epargne, color: "#8b5cf6" },
    ];
    if (autres > 0) list.push({ label: "Autres", amount: -autres, color: "#94a3b8" });
    list.push({ label: "Reste", amount: reste, color: reste >= 0 ? "#10b981" : "#dc2626", isTotal: true });
    return list;
  }, [income, besoins, envies, epargne, autres]);

  const bars = useMemo(() => {
    let running = 0;
    return steps.map((step) => {
      const start = step.isTotal ? 0 : running;
      const end = step.isTotal ? step.amount : running + step.amount;
      running = end;
      return { ...step, from: Math.min(start, end), to: Math.max(start, end), after: end };
    });
  }, [steps]);

  const { min, max, ticks } = useMemo(() => {
    const values = bars.flatMap((b) => [b.from, b.to]);
    const dataMin = Math.min(0, ...values);
    const dataMax = Math.max(0, ...values);
    const t = niceTicks(dataMin, dataMax);
    const span = dataMax - dataMin || 1;
    return { min: dataMin - span * 0.04, max: dataMax + span * 0.12, ticks: t };
  }, [bars]);

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slot = innerWidth / bars.length;
  const barWidth = Math.max(8, slot - 16);

  const x = (i: number) => PADDING.left + i * slot + slot / 2;
  const y = (v: number) => PADDING.top + innerHeight - ((v - min) / (max - min || 1)) * innerHeight;

  const hovered = hoverIndex !== null ? bars[hoverIndex] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
          Revenu / Reste
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          Besoins
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-pink-500" />
          Envies
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
          Épargne
        </span>
        {autres > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
            Autres
          </span>
        )}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Répartition du revenu du mois, de la source au reste à vivre">
          {ticks.map((t) => (
            <line
              key={t}
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--chart-grid-zero)" : "var(--chart-grid)"}
              strokeWidth={1}
            />
          ))}

          {bars.map((b, i) =>
            i === 0 ? null : (
              <line
                key={`connector-${i}`}
                x1={x(i - 1) + barWidth / 2}
                x2={x(i) - barWidth / 2}
                y1={y(bars[i - 1].after)}
                y2={y(bars[i - 1].after)}
                stroke="var(--chart-grid-zero)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ),
          )}

          {bars.map((b, i) => {
            const top = y(b.to);
            const bottom = y(b.from);
            const height = Math.max(2, bottom - top - BAR_GAP);
            return (
              <g key={b.label}>
                <rect
                  x={x(i) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={height}
                  rx={4}
                  fill={b.color}
                  opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.55}
                />
                <text x={x(i)} y={top - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--chart-text)">
                  {currency.format(b.isTotal ? b.amount : Math.abs(b.amount))}
                </text>
                <text x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--chart-text-muted)">
                  {b.label}
                </text>
                <rect
                  x={x(i) - slot / 2}
                  y={PADDING.top}
                  width={slot}
                  height={innerHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-md bg-violet-600 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `min(${(x(hoverIndex) / WIDTH) * 100}%, 75%)` }}
          >
            <p className="font-medium">{hovered.label}</p>
            <p>{currency.format(hovered.isTotal ? hovered.amount : Math.abs(hovered.amount))}</p>
          </div>
        )}
      </div>
    </div>
  );
}
