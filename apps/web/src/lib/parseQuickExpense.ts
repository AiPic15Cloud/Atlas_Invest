export function parseQuickExpense(text: string): { amount: number; poste: string } | null {
  const match = text.match(/(\d+(?:[.,]\d{1,2})?)\s*€?/);
  if (!match || match.index === undefined) return null;

  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const poste = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();

  return { amount, poste: poste || "Dépense" };
}
