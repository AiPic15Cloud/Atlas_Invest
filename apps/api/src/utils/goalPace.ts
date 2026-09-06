// Rythme réellement observé d'un objectif d'épargne (section 19 : "rythme
// prévu vs rythme réellement observé"), calculé depuis l'historique des
// contributions plutôt que déclaré à la main.
export function computeObservedMonthlyPace(
  contributions: { amount: number; date: Date }[],
  now: Date = new Date(),
): number | null {
  if (contributions.length === 0) return null;

  const netTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
  const earliest = contributions.reduce((min, c) => (c.date < min ? c.date : min), contributions[0].date);

  const monthsElapsed = Math.max(
    (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1,
    1,
  );

  return Math.round((netTotal / monthsElapsed) * 100) / 100;
}
