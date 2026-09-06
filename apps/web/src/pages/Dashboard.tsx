import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { AnnualLineChart } from "../components/AnnualLineChart";
import { StatTile } from "../components/StatTile";
import { useAuth } from "../context/AuthContext";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import {
  IconHome,
  IconSliders,
  IconShield,
  IconFlag,
  IconTrendingUp,
  IconWallet,
  IconChartLine,
  IconPlus,
  IconTarget,
  IconScissors,
} from "../components/icons";
import type { ComponentType } from "react";
import type { IconProps } from "../components/icons";
import type {
  BudgetCategory,
  DashboardResponse,
  EmergencyFundProfile,
  ExpensesResponse,
  MonthlyChallengeResponse,
  MonthlyGoal,
  MonthlyGoalsResponse,
  RecordsResponse,
  SavedEuroAllocation,
  SavedEurosResponse,
  SavingsGoal,
  SavingsGoalsResponse,
} from "../api/types";

const CATEGORY_BAR_COLOR: Record<BudgetCategory, string> = {
  BESOINS: "bg-copper-500",
  ENVIES: "bg-terracotta-500",
  EPARGNE: "bg-olive-500",
};

const HERO_QUICK_ACTIONS: { label: string; icon: ComponentType<IconProps>; to: string }[] = [
  { label: "Ajouter", icon: IconPlus, to: "/budget-du-mois" },
  { label: "Comptes", icon: IconWallet, to: "/comptes" },
  { label: "Mon plan", icon: IconSliders, to: "/budget-type" },
  { label: "Objectifs", icon: IconTarget, to: "/objectifs" },
];

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
  if (!data) return <p className="text-sm text-[#8a7358]">Chargement...</p>;

  const selected = data.monthly[selectedMonthIndex];
  const moneyFlowMax = Math.max(selected.income, selected.expense);
  const currentMonthLabel = MONTH_NAMES[new Date().getMonth()];
  const monthGoingWell = data.availableMoney.amount >= 0;
  const greeting = user?.firstName
    ? `Bonjour ${user.firstName}, ${currentMonthLabel} ${monthGoingWell ? "se présente bien" : "demande de l'attention"}.`
    : `${currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1)} ${monthGoingWell ? "se présente bien" : "demande de l'attention"}.`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <IconHome className="h-6 w-6 text-copper-600" />
            Accueil
          </h1>
          <p className="mt-0.5 text-sm text-[#8a7358]">Une vue claire de mon mois (ou de mon année).</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white dark:bg-[#241a12] p-1 shadow-sm ring-1 ring-[#e8dcc9]/80 dark:ring-[#3a2a1c]/80">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-md px-2.5 py-1 text-sm text-[#8a7358] hover:bg-[#ece0cb] dark:hover:bg-[#332417]"
            aria-label="Année précédente"
          >
            ←
          </button>
          <span className="min-w-[3.5rem] text-center text-sm font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-md px-2.5 py-1 text-sm text-[#8a7358] hover:bg-[#ece0cb] dark:hover:bg-[#332417]"
            aria-label="Année suivante"
          >
            →
          </button>
        </div>
      </div>

      <p className="font-display text-sm text-[#5a4530] dark:text-[#cbb89e]">{greeting}</p>

      <section
        className={`rounded-[28px] p-5 shadow-[0_1px_2px_rgba(43,29,20,0.06),0_12px_32px_-16px_rgba(43,29,20,0.22)] ring-1 sm:p-6 ${
          data.availableMoney.amount < 0
            ? "bg-terracotta-50 text-terracotta-900 ring-terracotta-200 dark:bg-terracotta-900/25 dark:text-terracotta-100 dark:ring-terracotta-800"
            : "bg-copper-50 text-[#2b1d14] ring-copper-200 dark:bg-copper-900/25 dark:text-[#f3e9dc] dark:ring-copper-800"
        }`}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-copper-700 dark:text-copper-300">
          Argent réellement disponible
        </p>
        <p className="font-display mt-1 text-3xl font-bold tracking-tight">{currency.format(data.availableMoney.amount)}</p>
        <p className="mt-1 text-sm opacity-75">
          Ton solde bancaire, moins les prélèvements à venir et les dépenses essentielles restantes ce mois-ci —
          plus fiable que le solde affiché par ta banque pour savoir ce que tu peux vraiment dépenser.
        </p>
        <dl className="mt-4 space-y-1.5 border-t border-copper-200/70 pt-3 text-xs opacity-80 dark:border-copper-800/60">
          <div className="flex justify-between">
            <dt>Solde actuel des comptes</dt>
            <dd className="font-medium">{currency.format(data.availableMoney.currentBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>− Prélèvements à venir ce mois</dt>
            <dd className="font-medium">{currency.format(data.availableMoney.upcomingCharges)}</dd>
          </div>
          {data.availableMoney.provisionsTotal > 0 && (
            <div className="flex justify-between">
              <dt>− Provisions (dépenses annuelles lissées)</dt>
              <dd className="font-medium">{currency.format(data.availableMoney.provisionsTotal)}</dd>
            </div>
          )}
          {data.availableMoney.hasEstimate ? (
            <>
              <div className="flex justify-between">
                <dt>− Essentiels restants estimés</dt>
                <dd className="font-medium">{currency.format(data.availableMoney.besoinsRemaining)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>− Épargne prévue restante</dt>
                <dd className="font-medium">{currency.format(data.availableMoney.epargneRemaining)}</dd>
              </div>
            </>
          ) : (
            <p className="italic">
              Crée ton plan (méthode à cibles fixes) pour affiner cette estimation avec tes essentiels et ton
              épargne prévue restants.
            </p>
          )}
        </dl>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-copper-200/70 pt-4 dark:border-copper-800/60">
          {HERO_QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-1 flex-col items-center gap-1.5 opacity-80 transition-colors hover:opacity-100"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 shadow-sm ring-1 ring-copper-200 dark:bg-white/10 dark:ring-copper-800">
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium">{action.label}</span>
            </button>
          ))}
        </div>
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
                  <div className="flex justify-between text-xs text-[#5a4530] dark:text-[#a8927a]">
                    <span>{cat === "BESOINS" ? "Besoins" : cat === "ENVIES" ? "Envies" : "Épargne"}</span>
                    <span className={over ? "font-medium text-red-600" : ""}>
                      {currency.format(actual)} / prévu {currency.format(target)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#ece0cb] dark:bg-[#332417]">
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
            icon={IconTrendingUp}
            label="Revenu annuel net"
            value={currency.format(data.totals.income)}
            color="emerald"
            hint={`${currency.format(data.averages.incomePerMonth)} / mois en moyenne`}
          />
          <StatTile
            icon={IconWallet}
            label="Dépensé sur l'année"
            value={currency.format(data.totals.expenses)}
            color="rose"
            hint={`${currency.format(data.averages.expensePerMonth)} / mois en moyenne`}
          />
          <StatTile
            icon={IconChartLine}
            label="Reste à vivre"
            value={currency.format(data.totals.reste)}
            color="sky"
            tone={data.totals.reste < 0 ? "warn" : "good"}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Revenu, dépenses et reste — {year}</h2>
        <AnnualLineChart monthly={data.monthly} selectedIndex={selectedMonthIndex} onSelectMonth={setSelectedMonthIndex} />

        <div className="mt-3 space-y-3 rounded-md bg-[#fdf6ee] dark:bg-[#332417]/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8a7358] dark:text-[#a8927a]">
            {MONTH_NAMES[selected.month - 1]} {selected.year}
          </p>
          <MoneyBar
            label="Argent qui rentre"
            formatted={currency.format(selected.income)}
            pct={moneyFlowMax > 0 ? Math.min((selected.income / moneyFlowMax) * 100, 100) : 0}
            colorClass="bg-olive-500"
          />
          <MoneyBar
            label="Argent qui sort"
            formatted={currency.format(selected.expense)}
            pct={moneyFlowMax > 0 ? Math.min((selected.expense / moneyFlowMax) * 100, 100) : 0}
            colorClass="bg-terracotta-500"
          />
          <p className="text-sm text-[#4a3826] dark:text-[#cbb89e]">
            Reste de {currency.format(selected.reste)}
            {selected.income > 0 && ` (dépenses = ${Math.round((selected.expense / selected.income) * 100)} % du revenu)`}.
          </p>
          <button
            onClick={() => navigate(`/budget-du-mois?year=${selected.year}&month=${selected.month}`)}
            className="text-sm link"
          >
            Voir le détail de ce mois
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold flex items-center gap-2">
            <IconSliders className="h-5 w-5 text-copper-600" />
            Mon plan
          </h2>
          {data.budgetTemplate ? (
            <>
              <p className="mt-2 text-sm text-[#4a3826] dark:text-[#cbb89e]">{data.budgetTemplate.label}</p>
              <Link to="/budget-type" className="btn btn-outline btn-sm mt-3">
                Voir mon plan →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-[#8a7358]">Tu n'as pas encore construit ton plan.</p>
              <Link to="/budget-type" className="btn btn-outline btn-sm mt-3">
                Construire mon plan →
              </Link>
            </>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold flex items-center gap-2">
            <IconShield className="h-5 w-5 text-copper-600" />
            Épargne de précaution
          </h2>
          {emergencyFund === undefined ? (
            <p className="mt-2 text-sm text-[#8a7358]">Chargement...</p>
          ) : emergencyFund ? (
            <>
              <p className="mt-2 text-sm text-[#4a3826] dark:text-[#cbb89e]">
                {currency.format(emergencyFund.currentSavedAmount)} sur {currency.format(emergencyFund.targetAmount)}{" "}
                ({Math.round(emergencyFund.progressRatio * 100)} %)
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ece0cb] dark:bg-[#332417]">
                <div
                  style={{ width: `${Math.min(emergencyFund.progressRatio * 100, 100)}%` }}
                  className="h-full bg-olive-500"
                />
              </div>
              <Link to="/epargne" className="btn btn-outline btn-sm mt-3">
                Voir le suivi →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-[#8a7358]">
                Réponds au questionnaire de vulnérabilité pour estimer ton objectif d'épargne de précaution.
              </p>
              <Link to="/epargne" className="btn btn-outline btn-sm mt-3">
                Ouvrir l'épargne de précaution →
              </Link>
            </>
          )}
        </section>
      </div>

      <MonthlyChallengeSection year={selected.year} month={selected.month} />
      <RecordsSection />
      <SavedEurosSection />
      <MonthlyGoalsSection year={selected.year} month={selected.month} />
    </div>
  );
}

const ALLOCATION_LABELS: Record<SavedEuroAllocation, string> = {
  OBJECTIF: "Un objectif",
  SECURITE: "Épargne de précaution",
  INVESTISSEMENT: "Investissement",
  DISPONIBLE: "Garder disponible",
};

function SavedEurosSection() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<SavedEurosResponse | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [allocation, setAllocation] = useState<SavedEuroAllocation>("DISPONIBLE");
  const [savingsGoalId, setSavingsGoalId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [savedRes, goalsRes] = await Promise.all([
        apiFetch<SavedEurosResponse>("/api/saved-euros"),
        apiFetch<SavingsGoalsResponse>("/api/savings-goals"),
      ]);
      setData(savedRes);
      setGoals(goalsRes.goals.filter((g) => !g.achieved));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les euros sauvés.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    if (allocation === "OBJECTIF" && !savingsGoalId) {
      setError("Choisis un objectif.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/saved-euros", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          amount: parsedAmount,
          allocation,
          savingsGoalId: allocation === "OBJECTIF" ? savingsGoalId : undefined,
        }),
      });
      setDescription("");
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return null;

  return (
    <section className="card">
      <h2 className="font-semibold flex items-center gap-2">
        <IconScissors className="h-5 w-5 text-copper-600" />
        Euros sauvés
      </h2>
      <p className="mt-1 text-sm text-[#8a7358]">
        Tu as renoncé à une dépense ? Note-la ici et choisis où faire vraiment aller cet argent — sinon ce n'est
        qu'une bonne intention.
      </p>
      {data.total > 0 && (
        <p className="mt-2 text-sm font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">
          {currency.format(data.total)} sauvés au total
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input
          className="input sm:col-span-2"
          placeholder="Ex. Commande annulée"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="input"
          placeholder="Montant"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="input"
          value={allocation}
          onChange={(e) => setAllocation(e.target.value as SavedEuroAllocation)}
        >
          {(Object.keys(ALLOCATION_LABELS) as SavedEuroAllocation[]).map((key) => (
            <option key={key} value={key}>
              {ALLOCATION_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {allocation === "OBJECTIF" && (
        <select className="input mt-2" value={savingsGoalId} onChange={(e) => setSavingsGoalId(e.target.value)}>
          <option value="">Choisis un objectif...</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      <button onClick={handleAdd} disabled={submitting} className="mt-3 btn btn-primary">
        {submitting ? "..." : "Enregistrer"}
      </button>

      {data.events.length > 0 && (
        <ul className="mt-3">
          {data.events.slice(0, 5).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 border-b border-[#ece0cb] py-2 last:border-0 dark:border-[#3a2a1c]"
            >
              <span className="flex-1 text-sm">
                {e.description} <span className="text-xs text-[#a8927a]">— {ALLOCATION_LABELS[e.allocation]}</span>
              </span>
              <span className="text-sm font-medium">{currency.format(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MONTH_NAME = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const MONTH_YEAR_NAME = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function RecordsSection() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<RecordsResponse | null>(null);

  useEffect(() => {
    apiFetch<RecordsResponse>("/api/records")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;
  const hasAnyRecord = data.bestEpargneMonth || data.bestSavingsRateMonth || data.bestRegretMonth || data.bestStreak > 0;
  if (!hasAnyRecord) return null;

  return (
    <section className="card">
      <h2 className="font-semibold flex items-center gap-2">
        <IconTrendingUp className="h-5 w-5 text-copper-600" />
        Série et records
      </h2>
      <p className="mt-1 text-sm text-[#8a7358]">
        Le foyer joue contre son propre historique, pas contre quelqu'un d'autre.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#f6efe1] p-3 dark:bg-[#3a2a1c]">
          <p className="text-xs text-[#a8927a]">Série en cours</p>
          <p className="text-lg font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">
            {data.currentStreak} mois consécutif{data.currentStreak > 1 ? "s" : ""} avec épargne
          </p>
          <p className="text-xs text-[#a8927a]">Record : {data.bestStreak} mois</p>
        </div>

        {data.bestEpargneMonth && (
          <div className="rounded-lg bg-[#f6efe1] p-3 dark:bg-[#3a2a1c]">
            <p className="text-xs text-[#a8927a]">Record d'épargne</p>
            <p className="text-lg font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">
              {currency.format(data.bestEpargneMonth.amount)}
            </p>
            <p className="text-xs text-[#a8927a] capitalize">
              {MONTH_YEAR_NAME.format(new Date(data.bestEpargneMonth.year, data.bestEpargneMonth.month - 1, 1))}
            </p>
          </div>
        )}

        {data.bestSavingsRateMonth && (
          <div className="rounded-lg bg-[#f6efe1] p-3 dark:bg-[#3a2a1c]">
            <p className="text-xs text-[#a8927a]">Meilleur taux d'épargne</p>
            <p className="text-lg font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">
              {Math.round(data.bestSavingsRateMonth.rate * 100)} %
            </p>
            <p className="text-xs text-[#a8927a] capitalize">
              {MONTH_YEAR_NAME.format(new Date(data.bestSavingsRateMonth.year, data.bestSavingsRateMonth.month - 1, 1))}
            </p>
          </div>
        )}

        {data.bestRegretMonth && (
          <div className="rounded-lg bg-[#f6efe1] p-3 dark:bg-[#3a2a1c]">
            <p className="text-xs text-[#a8927a]">Meilleur mois de dépenses regrettées</p>
            <p className="text-lg font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">
              {currency.format(data.bestRegretMonth.amount)}
            </p>
            <p className="text-xs text-[#a8927a] capitalize">
              {MONTH_YEAR_NAME.format(new Date(data.bestRegretMonth.year, data.bestRegretMonth.month - 1, 1))}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function MonthlyChallengeSection({ year, month }: { year: number; month: number }) {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<MonthlyChallengeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [targetAmount, setTargetAmount] = useState("");
  const [stretchGoalAmount, setStretchGoalAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<MonthlyChallengeResponse>(`/api/monthly-challenge?year=${year}&month=${month}`);
      setData(res);
      setEditing(!res.challenge);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le défi du mois.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleSave() {
    const parsedTarget = Number(targetAmount.replace(",", "."));
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) return;
    const parsedStretch = stretchGoalAmount ? Number(stretchGoalAmount.replace(",", ".")) : null;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/monthly-challenge", {
        method: "POST",
        body: JSON.stringify({
          year,
          month,
          targetAmount: parsedTarget,
          stretchGoalAmount: parsedStretch && parsedStretch > 0 ? parsedStretch : null,
        }),
      });
      setTargetAmount("");
      setStretchGoalAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return null;

  const pct = data.challenge ? Math.min((data.saved / data.challenge.targetAmount) * 100, 100) : 0;

  return (
    <section className="card">
      <h2 className="font-semibold flex items-center gap-2">
        <IconTarget className="h-5 w-5 text-copper-600" />
        Défi {MONTH_NAME.format(new Date(year, month - 1, 1))}
      </h2>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {data.challenge && !editing && (
        <>
          <p className="mt-2 text-sm text-[#8a7358]">
            Épargner {currency.format(data.challenge.targetAmount)} —{" "}
            <span className="font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">
              {currency.format(data.saved)} / {currency.format(data.challenge.targetAmount)}
            </span>{" "}
            — {currency.format(data.remaining)} restants
          </p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#ece0cb] dark:bg-[#4f3a26]">
            <div
              style={{ width: `${pct}%` }}
              className={`h-full rounded-full ${data.achieved ? "bg-olive-500" : "bg-copper-500"}`}
            />
          </div>
          {data.challenge.stretchGoalAmount !== null && (
            <p className="mt-2 text-xs text-[#a8927a]">
              {data.stretchReached ? "🔥 " : ""}Bonus : {currency.format(data.challenge.stretchGoalAmount)}
              {data.stretchReached ? " — atteint !" : ""}
            </p>
          )}
          <button
            onClick={() => {
              setTargetAmount(String(data.challenge!.targetAmount));
              setStretchGoalAmount(data.challenge!.stretchGoalAmount !== null ? String(data.challenge!.stretchGoalAmount) : "");
              setEditing(true);
            }}
            className="mt-3 text-xs text-[#a8927a] underline"
          >
            Modifier la cible
          </button>
        </>
      )}

      {editing && (
        <div className="mt-3">
          <p className="text-sm text-[#8a7358]">
            Fixez un montant d'épargne à atteindre ce mois-ci. L'avancement se base sur l'épargne réellement
            enregistrée dans Mon mois, pas sur une intention.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Cible (ex. 600)"
              inputMode="decimal"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
            <input
              className="input"
              placeholder="Bonus stretch goal (optionnel)"
              inputMode="decimal"
              value={stretchGoalAmount}
              onChange={(e) => setStretchGoalAmount(e.target.value)}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={handleSave} disabled={submitting} className="btn btn-primary btn-sm">
              {submitting ? "..." : "Valider"}
            </button>
            {data.challenge && (
              <button onClick={() => setEditing(false)} className="btn btn-outline btn-sm">
                Annuler
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MoneyBar({
  label,
  formatted,
  pct,
  colorClass,
}: {
  label: string;
  formatted: string;
  pct: number;
  colorClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[#5a4530] dark:text-[#a8927a]">
        <span>{label}</span>
        <span className="font-semibold text-[#2b1d14] dark:text-[#f3e9dc]">{formatted}</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#ece0cb] dark:bg-[#4f3a26]">
        <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${colorClass}`} />
      </div>
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
        <h2 className="font-semibold flex items-center gap-2">
          <IconFlag className="h-5 w-5 text-copper-600" />
          Nos victoires
        </h2>
        {goals && <span className="text-sm text-[#a8927a]">{doneCount}/{goals.length}</span>}
      </div>
      <p className="mt-1 text-sm text-[#8a7358]">
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
        <p className="mt-3 text-sm text-[#8a7358]">Chargement...</p>
      ) : goals.length === 0 ? (
        <p className="mt-3 text-sm text-[#8a7358]">Aucun objectif pour ce mois. Choisissez un emoji et ajoutez-en un.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center justify-between gap-2 border-b border-[#ece0cb] dark:border-[#3a2a1c] py-1.5 last:border-0">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input type="checkbox" checked={goal.done} onChange={() => handleToggle(goal)} />
                <span className={goal.done ? "text-[#a8927a] line-through" : ""}>
                  {goal.emoji ? `${goal.emoji} ` : ""}
                  {goal.label}
                </span>
              </label>
              <button onClick={() => handleDelete(goal.id)} className="text-xs text-[#a8927a] hover:text-terracotta-600">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

