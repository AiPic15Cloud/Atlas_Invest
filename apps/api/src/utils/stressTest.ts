// Stress tests (section 60) : "Le foyer pourrait absorber ce choc pendant
// environ X mois." Ne modifie jamais les données réelles (bac à sable, comme
// la simulation "Et si ?" de la section 59) — une projection à partir du
// rythme mensuel moyen actuel et de l'épargne de précaution disponible.
export type StressTestScenario =
  | { type: "INCOME_LOSS"; monthlyAmount: number }
  | { type: "INCOME_DROP_PERCENT"; percent: number }
  | { type: "ONE_OFF_EXPENSE"; amount: number }
  | { type: "RECURRING_EXPENSE_INCREASE"; monthlyAmount: number };

export interface StressTestResult {
  newMonthlyIncome: number;
  newMonthlyExpenses: number;
  newMonthlyBalance: number;
  bufferAfterShock: number;
  monthsSustainable: number | null;
  sustainableIndefinitely: boolean;
}

export function simulateStressTest(
  baselineMonthlyIncome: number,
  baselineMonthlyExpenses: number,
  availableBuffer: number,
  scenario: StressTestScenario,
): StressTestResult {
  let newMonthlyIncome = baselineMonthlyIncome;
  let newMonthlyExpenses = baselineMonthlyExpenses;
  let bufferAfterShock = availableBuffer;

  switch (scenario.type) {
    case "INCOME_LOSS":
      newMonthlyIncome = Math.max(baselineMonthlyIncome - scenario.monthlyAmount, 0);
      break;
    case "INCOME_DROP_PERCENT":
      newMonthlyIncome = baselineMonthlyIncome * (1 - scenario.percent / 100);
      break;
    case "ONE_OFF_EXPENSE":
      bufferAfterShock = availableBuffer - scenario.amount;
      break;
    case "RECURRING_EXPENSE_INCREASE":
      newMonthlyExpenses = baselineMonthlyExpenses + scenario.monthlyAmount;
      break;
  }

  const newMonthlyBalance = Math.round((newMonthlyIncome - newMonthlyExpenses) * 100) / 100;

  if (newMonthlyBalance >= 0) {
    return {
      newMonthlyIncome,
      newMonthlyExpenses,
      newMonthlyBalance,
      bufferAfterShock,
      monthsSustainable: null,
      sustainableIndefinitely: true,
    };
  }

  const monthsSustainable = bufferAfterShock > 0 ? Math.floor(bufferAfterShock / Math.abs(newMonthlyBalance)) : 0;

  return {
    newMonthlyIncome,
    newMonthlyExpenses,
    newMonthlyBalance,
    bufferAfterShock,
    monthsSustainable,
    sustainableIndefinitely: false,
  };
}
