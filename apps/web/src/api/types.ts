export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  householdId: string | null;
  shareDetailsWithHousehold: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  remainingBackupCodes: number;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
}

export interface HouseholdMember {
  id: string;
  firstName: string;
  isYou: boolean;
  shareDetailsWithHousehold: boolean;
}

export type HouseholdCurrency = "EUR" | "USD" | "GBP" | "CHF" | "CAD";

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  currency: HouseholdCurrency;
  fiscalYearStartMonth: number;
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

export interface BalanceCheckpoint {
  id: string;
  year: number;
  month: number;
  statedBalance: string;
  expectedBalance: string | null;
  discrepancy: string | null;
  createdAt: string;
}

export interface CheckpointsResponse {
  checkpoints: BalanceCheckpoint[];
}

export interface CreateCheckpointResponse {
  checkpoint: BalanceCheckpoint;
  isSignificantDiscrepancy: boolean;
}

export interface AccountEnvelope {
  id: string;
  name: string;
  amount: string;
  createdAt: string;
}

export interface AccountEnvelopesResponse {
  envelopes: AccountEnvelope[];
  allocated: number;
  free: number;
  overAllocated: boolean;
}

export type IncomeNature = "RECURRENT" | "EXCEPTIONNEL" | "REMBOURSEMENT" | "AUTRE";

export interface Income {
  id: string;
  year: number;
  month: number;
  source: string;
  nature: IncomeNature;
  amount: string;
  bankAccountId: string;
  bankAccountName: string;
  createdAt: string;
}

export interface IncomeSummaryMonth {
  month: number;
  total: number;
  incomes: { id: string; source: string; nature: IncomeNature; amount: string; bankAccountName: string }[];
}

export interface IncomeSummary {
  year: number;
  totalsByMonth: number[];
  nonRecurrentTotalByMonth: number[];
  byMonth: IncomeSummaryMonth[];
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

// Natures possibles d'une depense reelle : les 3 categories du budget type,
// plus 2 natures supplementaires (Lot 3) qui ne rentrent pas dans le
// barème de repartition 50/30/20.
export type ExpenseCategory = BudgetCategory | "INVESTISSEMENT" | "REMBOURSEMENT_DETTE";

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

export type ExpenseFeeling = "SATISFAIT" | "NEUTRE" | "REGRET";

export interface ExpenseSplit {
  id: string;
  category: ExpenseCategory;
  amount: string;
  note: string | null;
}

export interface Expense {
  id: string;
  year: number;
  month: number;
  poste: string;
  category: ExpenseCategory;
  amount: string;
  note: string | null;
  bankAccountId: string;
  bankAccountName: string;
  unusual: boolean;
  feeling: ExpenseFeeling | null;
  feelingReviewed: boolean;
  createdAt: string;
  splits: ExpenseSplit[];
}

export interface MonthlyComparisonColumn {
  category: BudgetCategory;
  reference: number;
  thisMonth: number;
  hasOverride: boolean;
  actual: number;
  projection: number;
}

export interface BudgetComparison {
  method: BudgetMethodKey;
  besoinsTarget: number;
  enviesTarget: number;
  epargneTarget: number;
  overBudgetCategories: { category: BudgetCategory; actual: number; target: number; overBy: number }[];
  columns: MonthlyComparisonColumn[];
}

export interface ExpensesSummary {
  totalSpent: number;
  totalIncome: number;
  regretTotal: number;
  byCategory: { besoins: number; envies: number; epargne: number };
  budgetComparison: BudgetComparison | null;
}

export interface FeelingSummary {
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
  year: number;
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
  | "jobStability"
  | "dependentsLoad"
  | "health"
  | "alternativeIncome"
  | "debtLevel"
  | "safetyNet"
  | "emotionalComfort"
  | "assetLiquidity",
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
    safetyNet: number;
    emotionalComfort: number;
    assetLiquidity: number;
  };
  breakdown: EmergencyFundCriterionBreakdown[];
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

export type SubscriptionStatus = "NON_EVALUE" | "A_GARDER" | "A_SURVEILLER" | "A_RESILIER";
export type UsageFrequency = "QUOTIDIEN" | "HEBDOMADAIRE" | "MENSUEL" | "RARE" | "JAMAIS";

export interface Subscription {
  id: string;
  poste: string;
  amount: string;
  annualCost: number;
  status: SubscriptionStatus;
  lastUsedAt: string | null;
  usageFrequency: UsageFrequency | null;
  cancelReminderAt: string | null;
  firstSeen: { year: number; month: number };
  lastSeen: { year: number; month: number };
  occurrences: number;
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  annualTotal: number;
}

export interface SavingsOpportunities {
  year: number;
  regret: { total: number; byPoste: { poste: string; count: number; total: number }[] };
  subscriptionsToCancel: { id: string; poste: string; monthlyAmount: number; annualCost: number }[];
  subscriptionsAnnualTotal: number;
  totalAnnual: number;
  totalMonthlyEquivalent: number;
  potentialLeaks: {
    items: { id: string; poste: string; status: SubscriptionStatus; monthlyAmount: number; annualCost: number }[];
    annualTotal: number;
    monthlyTotal: number;
  };
}

export interface Transfer {
  id: string;
  amount: string;
  date: string;
  note: string | null;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  createdAt: string;
}

export interface TransfersResponse {
  transfers: Transfer[];
}

export interface TransferCandidate {
  expenseId: string;
  incomeId: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  year: number;
  month: number;
}

export interface TransferCandidatesResponse {
  candidates: TransferCandidate[];
}

export interface RecurringCharge {
  id: string;
  label: string;
  amount: string;
  dayOfMonth: number;
  active: boolean;
  bankAccountId: string;
  bankAccountName: string;
  createdAt: string;
}

export interface RecurringChargeTimelineEntry {
  dayOfMonth: number;
  label: string;
  amount: number;
  projectedBalance: number;
}

export interface RecurringChargeAccountProjection {
  id: string;
  name: string;
  currentBalance: number;
  timeline: RecurringChargeTimelineEntry[];
  alert: { dayOfMonth: number; projectedBalance: number } | null;
}

export interface RecurringChargesResponse {
  charges: RecurringCharge[];
  accounts: RecurringChargeAccountProjection[];
  subscriptionsWithoutDate: { id: string; poste: string; amount: number }[];
}

export interface AnticipatedExpense {
  id: string;
  label: string;
  amount: number;
  year: number;
  month: number;
  note: string | null;
  createdAt: string;
}

export interface AnticipatedExpensesResponse {
  expenses: AnticipatedExpense[];
}

export interface RiskyMonth {
  year: number;
  month: number;
  monthsUntil: number;
  projectedIncome: number;
  projectedCharges: number;
  shortfall: number;
  risky: boolean;
  requiredMonthlyProvision: number | null;
}

export interface RiskyMonthsResponse {
  baselineIncome: number;
  baselineCharges: number;
  hasIncomeData: boolean;
  months: RiskyMonth[];
}

export type WealthCategory = "IMMOBILIER" | "VEHICULE" | "PLACEMENT" | "AUTRE_ACTIF" | "CREDIT" | "AUTRE_DETTE";
export type WealthKind = "ASSET" | "LIABILITY";

export interface WealthCategoryDefinition {
  label: string;
  kind: WealthKind;
}

export type ValuationSource = "MANUELLE" | "MARCHE" | "ESTIMATION" | "HISTORIQUE";

export interface WealthItem {
  id: string;
  label: string;
  category: WealthCategory;
  kind: WealthKind;
  amount: string;
  signedAmount: number;
  lastValuationSource: ValuationSource | null;
  lastValuationDate: string | null;
  createdAt: string;
}

export interface AssetValuation {
  id: string;
  value: string;
  valuationDate: string;
  source: ValuationSource;
  note: string | null;
  createdAt: string;
}

export interface AssetValuationsResponse {
  valuations: AssetValuation[];
}

export interface WealthHouseholdMember {
  userId: string;
  firstName: string;
  sharesDetails: boolean;
  bankAccountsTotal?: number;
  wealthItems?: WealthItem[];
  loansTotal?: number;
  netWorth: number;
}

export interface WealthResponse {
  mine: {
    bankAccountsTotal: number;
    wealthItems: WealthItem[];
    wealthItemsTotal: number;
    loansTotal: number;
    netWorth: number;
  } | null;
  joint: { accountsTotal: number };
  household: WealthHouseholdMember[];
  householdNetWorth: number;
  categories: Record<WealthCategory, WealthCategoryDefinition>;
}

export interface WealthVariationResponse {
  available: boolean;
  reason?: string;
  currentMonth: { year: number; month: number };
  currentNetWorth: number;
  previousMonth?: { year: number; month: number };
  previousNetWorth?: number;
  totalVariation?: number;
  epargne?: number;
  investissement?: number;
  capitalRembourse?: number;
  unexplained?: number;
}

export interface Loan {
  id: string;
  label: string;
  principalAmount: number;
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number | null;
  startDate: string;
  endDate: string | null;
  progressRatio: number;
  monthsRemaining: number | null;
  projectedPayoffDate: string | null;
  paidOff: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface LoansResponse {
  loans: Loan[];
}

export interface DebtCockpitLoan {
  id: string;
  label: string;
  remainingBalance: number;
  monthlyPayment: number;
  monthsRemaining: number | null;
  endDate: string | null;
  estimatedRemainingInterest: number | null;
  neverPaysOff: boolean;
}

export interface EarlyRepaymentProjection {
  monthsRemaining: number | null;
  endDate: string | null;
  estimatedRemainingInterest: number | null;
  neverPaysOff: boolean;
}

export interface EarlyRepaymentResponse {
  newRemainingBalance: number;
  before: EarlyRepaymentProjection;
  after: EarlyRepaymentProjection;
  interestSaved: number | null;
  monthsSaved: number | null;
  reducedMonthlyPayment: number | null;
  emergencyFundImpact: { currentSavedAmount: number; remainingAfter: number } | null;
}

export interface DebtCockpitResponse {
  totalDebt: number;
  totalRemainingBalance: number;
  totalMonthlyPayments: number;
  totalEstimatedRemainingInterest: number | null;
  hasUnknownInterest: boolean;
  incomeShare: number | null;
  nextFreedPayment: { loanId: string; label: string; endDate: string; amount: number } | null;
  loans: DebtCockpitLoan[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  progressRatio: number;
  targetDate: string | null;
  monthlyContribution: number | null;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  observedMonthlyPace: number | null;
  priority: number | null;
  achieved: boolean;
  createdAt: string;
}

export interface SavingsGoalsResponse {
  goals: SavingsGoal[];
}

export interface SurplusAllocationLine {
  goalId: string;
  goalName: string;
  amount: number;
}

export interface SurplusAllocationResponse {
  allocations: SurplusAllocationLine[];
  leftover: number;
}

export type HouseholdSplitMode =
  | "PRORATA_REVENUS"
  | "PARTS_EGALES"
  | "RESTE_EGAL"
  | "POURCENTAGE_CHOISI"
  | "FORFAIT_FIXE"
  | "POT_COMMUN_POURCENTAGE"
  | "A_LA_CARTE";

export interface HouseholdSplitMember {
  userId: string;
  firstName: string;
  isYou: boolean;
  income: number;
  share: number;
  amountDue: number;
  resteAVivre: number;
  customValue: number | null;
}

export interface HouseholdSplitExpense {
  id: string;
  poste: string;
  amount: number;
  assignedToUserId: string | null;
}

export interface HouseholdSplitResponse {
  jointExpensesTotal: number;
  totalIncome: number;
  members: HouseholdSplitMember[];
  mode: HouseholdSplitMode;
  customShares: Record<string, number>;
  expenses?: HouseholdSplitExpense[];
  fallbackToEqual: boolean;
  note: string | null;
}

export interface MonthlyGoal {
  id: string;
  year: number;
  month: number;
  label: string;
  emoji: string | null;
  done: boolean;
  createdAt: string;
}

export interface MonthlyGoalsResponse {
  goals: MonthlyGoal[];
}

export interface MonthlyChallenge {
  id: string;
  year: number;
  month: number;
  targetAmount: number;
  stretchGoalAmount: number | null;
  createdAt: string;
}

export interface MonthlyChallengeResponse {
  challenge: MonthlyChallenge | null;
  saved: number;
  remaining: number;
  achieved: boolean;
  stretchReached: boolean;
}

export type SavedEuroAllocation = "OBJECTIF" | "SECURITE" | "INVESTISSEMENT" | "DISPONIBLE";

export interface SavedEuroEvent {
  id: string;
  description: string;
  amount: number;
  allocation: SavedEuroAllocation;
  savingsGoalId: string | null;
  createdAt: string;
}

export interface SavedEurosResponse {
  events: SavedEuroEvent[];
  total: number;
}

export interface RecordsResponse {
  currentStreak: number;
  bestStreak: number;
  bestEpargneMonth: { year: number; month: number; amount: number } | null;
  bestSavingsRateMonth: { year: number; month: number; rate: number } | null;
  bestRegretMonth: { year: number; month: number; amount: number } | null;
}

export interface EmergencyFundCriterionBreakdown {
  key: string;
  question: string;
  value: number;
  maxValue: number;
  label: string;
  options: { value: number; label: string }[];
}

export type CorrectionType =
  | "WASTEFUL_EXPENSE"
  | "SUBSCRIPTION_STATUS"
  | "TRANSFER_SUGGESTION_DISMISSED"
  | "BUDGET_ITEM_MODIFIED"
  | "GOAL_TARGET_MODIFIED"
  | "LOAN_MODIFIED"
  | "EXPENSE_RECATEGORIZED";

export interface CorrectionLogEntry {
  id: string;
  type: CorrectionType;
  label: string;
  detail: string | null;
  createdAt: string;
}

export interface CorrectionHistoryResponse {
  logs: CorrectionLogEntry[];
}

export interface AvailableMoney {
  currentBalance: number;
  upcomingCharges: number;
  besoinsRemaining: number;
  epargneRemaining: number;
  provisionsTotal: number;
  amount: number;
  hasEstimate: boolean;
}

export interface Provision {
  id: string;
  label: string;
  annualAmount: number;
  monthlyAmount: number;
  active: boolean;
  createdAt: string;
}

export interface ProvisionsResponse {
  provisions: Provision[];
  activeMonthlyTotal: number;
}

export type StressTestScenario =
  | { type: "INCOME_LOSS"; monthlyAmount: number }
  | { type: "INCOME_DROP_PERCENT"; percent: number }
  | { type: "ONE_OFF_EXPENSE"; amount: number }
  | { type: "RECURRING_EXPENSE_INCREASE"; monthlyAmount: number };

export interface StressTestResponse {
  baselineMonthlyIncome: number;
  baselineMonthlyExpenses: number;
  availableBuffer: number;
  hasEmergencyFund: boolean;
  newMonthlyIncome: number;
  newMonthlyExpenses: number;
  newMonthlyBalance: number;
  bufferAfterShock: number;
  monthsSustainable: number | null;
  sustainableIndefinitely: boolean;
}

export interface DashboardResponse {
  year: number;
  fiscalYearStartMonth: number;
  totals: { income: number; expenses: number; reste: number };
  averages: { incomePerMonth: number; expensePerMonth: number };
  monthly: DashboardMonth[];
  availableMoney: AvailableMoney;
  budgetTemplate: { method: BudgetMethodKey; label: string } | null;
}
