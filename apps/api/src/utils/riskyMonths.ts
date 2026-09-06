// Détection des mois à risque (section 29) : projette, sur les mois futurs, le
// revenu récurrent et les charges fixes déjà connues (échéances + provisions),
// et signale les mois où une dépense ponctuelle anticipée les ferait basculer
// en déficit — avec le versement mensuel qu'il faudrait provisionner d'ici là
// pour lisser ce déficit. Reste une estimation fondée sur des montants déjà
// connus aujourd'hui, jamais une certitude (doctrine section 2).
export interface RiskyMonthInput {
  year: number;
  month: number;
  anticipatedExpenses: number;
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

export function computeRiskyMonths(
  baselineIncome: number,
  baselineCharges: number,
  months: RiskyMonthInput[],
): RiskyMonth[] {
  return months.map((m, index) => {
    const monthsUntil = index + 1;
    const projectedIncome = Math.round(baselineIncome * 100) / 100;
    const projectedCharges = Math.round((baselineCharges + m.anticipatedExpenses) * 100) / 100;
    const shortfall = Math.round(Math.max(projectedCharges - projectedIncome, 0) * 100) / 100;
    const risky = shortfall > 0;
    return {
      year: m.year,
      month: m.month,
      monthsUntil,
      projectedIncome,
      projectedCharges,
      shortfall,
      risky,
      requiredMonthlyProvision: risky ? Math.round((shortfall / monthsUntil) * 100) / 100 : null,
    };
  });
}
