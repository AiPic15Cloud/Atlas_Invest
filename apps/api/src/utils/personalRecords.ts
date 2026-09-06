// Records personnels (section 53) : le foyer cherche a battre ses propres
// performances passees, jamais a se comparer a quelqu'un d'autre.
export interface MonthlyRecordInput {
  year: number;
  month: number;
  income: number;
  epargne: number;
  regretTotal: number;
  hasActivity: boolean;
}

export interface MonthRef {
  year: number;
  month: number;
}

export interface BestEpargneRecord extends MonthRef {
  amount: number;
}

export interface BestSavingsRateRecord extends MonthRef {
  rate: number;
}

export interface BestRegretRecord extends MonthRef {
  amount: number;
}

export interface PersonalRecords {
  bestEpargneMonth: BestEpargneRecord | null;
  bestSavingsRateMonth: BestSavingsRateRecord | null;
  bestRegretMonth: BestRegretRecord | null;
}

export function computePersonalRecords(months: MonthlyRecordInput[]): PersonalRecords {
  let bestEpargneMonth: BestEpargneRecord | null = null;
  let bestSavingsRateMonth: BestSavingsRateRecord | null = null;
  let bestRegretMonth: BestRegretRecord | null = null;

  for (const m of months) {
    if (!m.hasActivity) continue;

    if (m.epargne > 0 && (bestEpargneMonth === null || m.epargne > bestEpargneMonth.amount)) {
      bestEpargneMonth = { year: m.year, month: m.month, amount: m.epargne };
    }

    if (m.income > 0) {
      const rate = m.epargne / m.income;
      if (bestSavingsRateMonth === null || rate > bestSavingsRateMonth.rate) {
        bestSavingsRateMonth = { year: m.year, month: m.month, rate };
      }
    }

    if (bestRegretMonth === null || m.regretTotal < bestRegretMonth.amount) {
      bestRegretMonth = { year: m.year, month: m.month, amount: m.regretTotal };
    }
  }

  return { bestEpargneMonth, bestSavingsRateMonth, bestRegretMonth };
}
