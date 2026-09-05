import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { AnnualLineChart } from "../components/AnnualLineChart";
import { useAuth } from "../context/AuthContext";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type {
  BudgetCategory,
  DashboardResponse,
  EmergencyFundProfile,
  ExpensesResponse,
  MonthlyGoal,
  MonthlyGoalsResponse,
} from "../api/types";

const CATEGORY_BAR_COLOR: Record<BudgetCategory, string> = {
  BESOINS: "bg-amber-500",
  ENVIES: "bg-pink-500",
  EPARGNE: "bg-violet-500",
};

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function defaultMonthIndex(monthly: DashboardResponse["monthly"]) {
  const now = new Date();
  const currentIndex = monthly.findIndex((m) => m.year === now.getFullYear() && m.month === now.getMonth() + 1);
  if (currentIndex !== -1) return currentIndex;
  return now.getFullYear() > (monthly[0]?.year ?? now.getFullYear()) ? 11 : 0;
}

export function Dashboard() {
  const currency = useCurrencyFormatter();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(11);
  const [emergencyFund, setEmergencyFund] = useState<EmergencyFundProfile | null | undefined>(undefined);
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState<ExpensesResponse | null>(null);

  async function load() {
    try {
      const res = await apiFetch<DashboardResponse>(`/api/dashboard?year=${year}`);
      setData(res);
      setSelectedMonthIndex(defaultMonthIndex(res.monthly));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le tableau de bord.");
    }
  }

  useEffect(() => {
    apiFetch<{ profile: EmergencyFundProfile | null }>("/api/emergency-fund").then((res) =>
      setEmergencyFund(res.profile),
    );
    const now = new Date();
    apiFetch<ExpensesResponse>(`/api/expenses?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then(
      setCurrentMonthExpenses,
    );
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  const selected = data.monthly[selectedMonthIndex];
  const currentMonthLabel = MONTH_NAMES[new Date().getMonth()];
  const monthGoingWell = data.availableMoney.amount >= 0;
  const greeting = user?.firstName
    ? `Bonjour ${user.firstName}, ${currentMonthLabel} ${monthGoingWell ? "se présente bien 🙂" : "demande de l'attention 👀"}.`
    : `${currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1)} ${monthGoingWell ? "se présente bien 🙂" : "demande de l'attention 👀"}.`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">🏠 Accueil</h1>
          <p className="mt-0.5 text-sm text-slate-500">Une vue claire de mon mois (ou de mon année). 💡</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-md px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Année précédente"
          >
            ←
          </button>
          <span className="min-w-[3.5rem] text-center text-sm font-semibold text-slate-900">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-md px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Année suivante"
          >
            →
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-600">{greeting}</p>

      <section className="card">
        <p className="stat-label">🏦 Argent réellement disponible</p>
        <p
          className={`mt-1 text-3xl font-bold tracking-tight ${
            data.availableMoney.amount < 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {currency.format(data.availableMoney.amount)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Ton solde bancaire, moins les prélèvements à venir et les dépenses essentielles restantes ce mois-ci —
          plus fiable que le solde affiché par ta banque pour savoir ce que tu peux vraiment dépenser.
        </p>
        <dl className="mt-3 space-y-1 text-xs text-slate-500">
          <div className="flex justify-between">
            <dt>Solde actuel des comptes</dt>
            <dd className="font-medium text-slate-700">{currency.format(data.availableMoney.currentBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>− Prélèvements à venir ce mois</dt>
            <dd className="font-medium text-slate-700">{currency.format(data.availableMoney.upcomingCharges)}</dd>
          </div>
          {data.availableMoney.hasEstimate ? (
            <>
              <div className="flex justify-between">
                <dt>− Essentiels restants estimés</dt>
                <dd className="font-medium text-slate-700">{currency.format(data.availableMoney.besoinsRemaining)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>− Épargne prévue restante</dt>
                <dd className="font-medium text-slate-700">{currency.format(data.availableMoney.epargneRemaining)}</dd>
              </div>
            </>
          ) : (
            <p className="italic">
              Crée ton plan (méthode à cibles fixes) pour affiner cette estimation avec tes essentiels et ton
              épargne prévue restants.
            </p>
          )}
        </dl>
      </section>

      {currentMonthExpenses?.summary.budgetComparison && (
        <section className="card">
          <h2 className="font-semibold">Ce mois : prévu vs réel</h2>
          <div className="mt-3 space-y-3">
            {(["BESOINS", "ENVIES", "EPARGNE"] as BudgetCategory[]).map((cat) => {
              const key = cat.toLowerCase() as "besoins" | "envies" | "epargne";
              const actual = currentMonthExpenses.summary.byCategory[key];
              const target =
                cat === "BESOINS"
                  ? currentMonthExpenses.summary.budgetComparison!.besoinsTarget
                  : cat === "ENVIES"
                    ? currentMonthExpenses.summary.budgetComparison!.enviesTarget
                    : currentMonthExpenses.summary.budgetComparison!.epargneTarget;
              const pct = target > 0 ? Math.min(actual / target, 1) * 100 : actual > 0 ? 100 : 0;
              const over = actual > target;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{cat === "BESOINS" ? "Besoins" : cat === "ENVIES" ? "Envies" : "Épargne"}</span>
                    <span className={over ? "font-medium text-red-600" : ""}>
                      {currency.format(actual)} / prévu {currency.format(target)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${over ? "bg-red-500" : CATEGORY_BAR_COLOR[cat]}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="💶 Revenu annuel net"
            value={currency.format(data.totals.income)}
            hint={`${currency.format(data.averages.incomePerMonth)} / mois en moyenne`}
          />
          <StatTile
            label="💸 Dépensé sur l'année"
            value={currency.format(data.totals.expenses)}
            hint={`${currency.format(data.averages.expensePerMonth)} / mois en moyenne`}
          />
          <StatTile
            label="🏦 Reste à vivre"
            value={currency.format(data.totals.reste)}
            tone={data.totals.reste < 0 ? "warn" : "success"}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Revenu, dépenses et reste — {year}</h2>
        <AnnualLineChart monthly={data.monthly} selectedIndex={selectedMonthIndex} onSelectMonth={setSelectedMonthIndex} />

        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            <span className="font-medium">En {MONTH_NAMES[selected.month - 1]}</span> : revenu de{" "}
            {currency.format(selected.income)}, dépenses de {currency.format(selected.expense)}
            {selected.income > 0 && ` (${Math.round((selected.expense / selected.income) * 100)} % du revenu)`}, reste
            de {currency.format(selected.reste)}.
          </p>
          <button
            onClick={() => navigate(`/budget-du-mois?year=${selected.year}&month=${selected.month}`)}
            className="mt-1 text-sm link"
          >
            Voir le détail de ce mois
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">🧭 Mon plan</h2>
          {data.budgetTemplate ? (
            <>
              <p className="mt-2 text-sm text-slate-700">{data.budgetTemplate.label}</p>
              <Link to="/budget-type" className="btn btn-outline btn-sm mt-3">
                Voir mon plan →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">Tu n'as pas encore construit ton plan.</p>
              <Link to="/budget-type" className="btn btn-outline btn-sm mt-3">
                Construire mon plan →
              </Link>
            </>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold">🛡️ Épargne de précaution</h2>
          {emergencyFund === undefined ? (
            <p className="mt-2 text-sm text-slate-500">Chargement...</p>
          ) : emergencyFund ? (
            <>
              <p className="mt-2 text-sm text-slate-700">
                {currency.format(emergencyFund.currentSavedAmount)} sur {currency.format(emergencyFund.targetAmount)}{" "}
                ({Math.round(emergencyFund.progressRatio * 100)} %)
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  style={{ width: `${Math.min(emergencyFund.progressRatio * 100, 100)}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <Link to="/epargne" className="btn btn-outline btn-sm mt-3">
                Voir le suivi →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Réponds au questionnaire de vulnérabilité pour estimer ton objectif d'épargne de précaution.
              </p>
              <Link to="/epargne" className="btn btn-outline btn-sm mt-3">
                Ouvrir l'épargne de précaution →
              </Link>
            </>
          )}
        </section>
      </div>

      <MonthlyGoalsSection year={selected.year} month={selected.month} />
    </div>
  );
}

function MonthlyGoalsSection({ year, month }: { year: number; month: number }) {
  const [goals, setGoals] = useState<MonthlyGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("🎯");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<MonthlyGoalsResponse>(`/api/monthly-goals?year=${year}&month=${month}`);
      setGoals(res.goals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les objectifs du mois.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleAdd() {
    if (!label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/monthly-goals", {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), emoji: emoji.trim() || null, year, month }),
      });
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(goal: MonthlyGoal) {
    try {
      await apiFetch(`/api/monthly-goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ done: !goal.done }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/monthly-goals/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    }
  }

  const doneCount = goals?.filter((g) => g.done).length ?? 0;

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🏆 Nos victoires</h2>
        {goals && <span className="text-sm text-slate-400">{doneCount}/{goals.length}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Notez ce que vous voulez accomplir ce mois, puis cochez chaque réussite, même les plus petites.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="w-12 input px-2 py-1.5 text-center text-sm"
          maxLength={4}
          aria-label="Emoji"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex. Épargner 200 €"
          className="min-w-[140px] flex-1 input"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} disabled={submitting} className="btn btn-primary">
          Ajouter
        </button>
      </div>

      {!goals ? (
        <p className="mt-3 text-sm text-slate-500">Chargement...</p>
      ) : goals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Aucun objectif pour ce mois. Choisissez un emoji et ajoutez-en un.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input type="checkbox" checked={goal.done} onChange={() => handleToggle(goal)} />
                <span className={goal.done ? "text-slate-400 line-through" : ""}>
                  {goal.emoji ? `${goal.emoji} ` : ""}
                  {goal.label}
                </span>
              </label>
              <button onClick={() => handleDelete(goal.id)} className="text-xs text-slate-400 hover:text-red-600">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "success";
  hint?: string;
}) {
  const toneClass = tone === "warn" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg bg-slate-50 p-3.5">
      <p className="stat-label">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
