export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  householdId: string | null;
  shareDetailsWithHousehold: boolean;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  firstName: string;
  isYou: boolean;
  shareDetailsWithHousehold: boolean;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
}

export type BankAccountType = "COURANT" | "LIVRET" | "PRO" | "JOINT" | "AUTRE";

export interface BankAccount {
  id: string;
  name: string;
  type: BankAccountType;
  initialBalance: string;
  ownerId: string | null;
  createdAt: string;
}

export interface HouseholdMemberAccounts {
  userId: string;
  firstName: string;
  sharesDetails: boolean;
  accounts?: BankAccount[];
  accountCount?: number;
  total?: number;
}

export interface BankAccountsResponse {
  mine: BankAccount[];
  joint: BankAccount[];
  household: HouseholdMemberAccounts[];
}

export interface Income {
  id: string;
  year: number;
  month: number;
  source: string;
  amount: string;
  bankAccountId: string;
  bankAccountName: string;
  createdAt: string;
}

export interface IncomeSummary {
  year: number;
  totalsByMonth: number[];
}

export type BudgetMethodKey =
  | "CONFORTABLE_50_30_20"
  | "TENDUE_60_25_15"
  | "TRES_TENDUE_70_20_10"
  | "BASE_ZERO"
  | "QUATRE_VINGT_VINGT"
  | "CASCADES_3";

export interface BudgetMethodDefinition {
  splitMode: "FIXED" | "CASCADE" | "ZERO_BASED";
  label: string;
  description: string;
  besoinsPct?: number;
  enviesPct?: number;
  epargnePct?: number;
}

export type BudgetCategory = "BESOINS" | "ENVIES" | "EPARGNE";

export interface BudgetItemNode {
  id: string;
  category: BudgetCategory;
  name: string;
  monthlyAmount: number;
  displayedAmount: number;
  essential: boolean;
  sortOrder: number;
  parentId: string | null;
  children: BudgetItemNode[];
}

export interface BudgetBreakdown {
  besoinsTarget: number;
  enviesTarget: number;
  epargneTarget: number;
  besoinsActual: number;
  enviesActual: number;
  epargneActual: number;
  resteAVivre: number;
  capaciteEpargne: number;
}

export interface BudgetTemplate {
  id: string;
  method: BudgetMethodKey;
  monthlyIncome: number;
  breakdown: BudgetBreakdown;
  items: {
    besoins: BudgetItemNode[];
    envies: BudgetItemNode[];
    epargne: BudgetItemNode[];
  };
}

export interface BudgetTemplateResponse {
  template: BudgetTemplate | null;
  methods: Record<BudgetMethodKey, BudgetMethodDefinition>;
}

export interface Expense {
  id: string;
  year: number;
  month: number;
  poste: string;
  category: BudgetCategory;
  amount: string;
  note: string | null;
  bankAccountId: string;
  bankAccountName: string;
  unusual: boolean;
  wasteful: boolean;
  wastefulReviewed: boolean;
  createdAt: string;
}

export interface BudgetComparison {
  method: BudgetMethodKey;
  besoinsTarget: number;
  enviesTarget: number;
  epargneTarget: number;
  overBudgetCategories: { category: BudgetCategory; actual: number; target: number; overBy: number }[];
}

export interface ExpensesSummary {
  totalSpent: number;
  totalIncome: number;
  wastefulTotal: number;
  byCategory: { besoins: number; envies: number; epargne: number };
  budgetComparison: BudgetComparison | null;
}

export interface WastefulSummary {
  year: number;
  total: number;
  byPoste: { poste: string; count: number; total: number }[];
}

export interface ExpensesResponse {
  expenses: Expense[];
  summary: ExpensesSummary;
}

export interface DashboardMonth {
  month: number;
  income: number;
  expense: number;
  reste: number;
}

export type CriterionValue = 1 | 3 | 5;

export interface CriterionOption {
  value: CriterionValue;
  label: string;
}

export interface Criterion {
  question: string;
  options: CriterionOption[];
}

export type EmergencyFundCriteria = Record<
  "jobStability" | "dependentsLoad" | "health" | "alternativeIncome" | "debtLevel",
  Criterion
>;

export interface SavingsEnvelope {
  id: string;
  name: string;
  monthlyAllocation: number;
}

export interface EmergencyFundProfile {
  answers: {
    jobStability: number;
    dependentsLoad: number;
    health: number;
    alternativeIncome: number;
    debtLevel: number;
  };
  score: number;
  recommendedMonths: number;
  monthsOverride: number | null;
  targetMonths: number;
  essentialMonthlyExpense: number;
  targetAmount: number;
  currentSavedAmount: number;
  remainingAmount: number;
  progressRatio: number;
  defaultMonthlySavingsCapacity: number;
  monthlySavingsCapacityOverride: number | null;
  monthlySavingsCapacity: number;
  monthsRemaining: number | null;
  envelopes: SavingsEnvelope[];
  envelopesTotal: number;
  updatedAt: string;
}

export interface DashboardResponse {
  year: number;
  totals: { income: number; expenses: number; reste: number };
  averages: { incomePerMonth: number; expensePerMonth: number };
  monthly: DashboardMonth[];
  budgetTemplate: { method: BudgetMethodKey; label: string } | null;
}
