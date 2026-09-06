// Liste inclusive des mois entre (fromYear, fromMonth) et (toYear, toMonth),
// utilisée pour additionner les revenus/dépenses (qui ne connaissent que
// l'année et le mois, pas une date exacte) sur la période écoulée depuis le
// dernier point de contrôle.
export function monthsInRange(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): { year: number; month: number }[] {
  const from = fromYear * 12 + (fromMonth - 1);
  const to = toYear * 12 + (toMonth - 1);
  const months: { year: number; month: number }[] = [];
  for (let m = from; m <= to; m++) {
    months.push({ year: Math.floor(m / 12), month: (m % 12) + 1 });
  }
  return months;
}

// Rapprochement bancaire (spec section 68) :
// solde attendu = solde du dernier point de contrôle + revenus - dépenses
// +/- transferts sur la période écoulée depuis ce point.
export function computeExpectedBalance(params: {
  previousStatedBalance: number;
  incomesTotal: number;
  expensesTotal: number;
  transfersInTotal: number;
  transfersOutTotal: number;
}): number {
  const { previousStatedBalance, incomesTotal, expensesTotal, transfersInTotal, transfersOutTotal } = params;
  return previousStatedBalance + incomesTotal - expensesTotal + transfersInTotal - transfersOutTotal;
}

// Écart de rapprochement = ce que l'utilisateur constate - ce qui était
// attendu. Positif = plus d'argent que prévu, négatif = moins.
// Un écart en dessous du seuil (arrondis bancaires/centimes) n'est pas
// signalé comme incohérence — spec 68 exige de ne jamais cacher un écart
// réel, pas de faire du bruit sur des centimes d'arrondi.
const DISCREPANCY_THRESHOLD = 0.01;

export function computeDiscrepancy(statedBalance: number, expectedBalance: number): number {
  return Math.round((statedBalance - expectedBalance) * 100) / 100;
}

export function isSignificantDiscrepancy(discrepancy: number): boolean {
  return Math.abs(discrepancy) > DISCREPANCY_THRESHOLD;
}
