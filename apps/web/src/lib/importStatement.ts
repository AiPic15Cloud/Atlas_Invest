import type { BudgetCategory } from "../api/types";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
}

export interface ImportGroup {
  merchantKey: string;
  suggestedPoste: string;
  suggestedCategory: BudgetCategory;
  transactions: ParsedTransaction[];
  total: number;
}

export interface ParseResult {
  groups: ImportGroup[];
  skippedCredits: number;
  skippedUnparsable: number;
  skippedTransfers: number;
}

function isInternalTransfer(description: string, ownAccountNames: string[]): boolean {
  if (!ownAccountNames.length) return false;
  const upper = description.toUpperCase();
  if (!/\bVIR/.test(upper)) return false;
  return ownAccountNames.some((name) => name.trim().length > 0 && upper.includes(name.trim().toUpperCase()));
}

const DELIMITERS = [";", ",", "\t"];

function detectDelimiter(firstLines: string[]): string {
  let best = DELIMITERS[0];
  let bestCount = -1;
  for (const delimiter of DELIMITERS) {
    const count = firstLines.reduce((sum, line) => sum + line.split(delimiter).length, 0);
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/[€]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const HEADER_HINTS = ["date", "libelle", "libellé", "description", "montant", "debit", "débit", "credit", "crédit"];

function looksLikeHeader(fields: string[]): boolean {
  const lower = fields.map((f) => f.trim().toLowerCase());
  return lower.some((f) => HEADER_HINTS.includes(f));
}

function findColumnIndex(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse un relevé colle en texte brut : CSV avec en-tete (Date/Libelle/Montant
 * ou Date/Libelle/Debit/Credit), CSV sans en-tete (3 colonnes), ou une simple
 * liste "libelle montant" une ligne par transaction. Ne garde que les
 * depenses (montants negatifs ou colonne debit) ; les revenus/credits sont
 * comptes a part et ignores.
 */
export function parseStatementText(text: string, ownAccountNames: string[] = []): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const transactions: ParsedTransaction[] = [];
  let skippedCredits = 0;
  let skippedUnparsable = 0;
  let skippedTransfers = 0;

  if (lines.length === 0) {
    return { groups: [], skippedCredits: 0, skippedUnparsable: 0, skippedTransfers: 0 };
  }

  const delimiter = detectDelimiter(lines.slice(0, 5));
  const rows = lines.map((l) => l.split(delimiter).map((f) => f.trim()));

  let dataRows = rows;
  let dateIdx = 0;
  let descIdx = 1;
  let amountIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;

  if (rows[0].length >= 2 && looksLikeHeader(rows[0])) {
    const header = rows[0];
    dateIdx = findColumnIndex(header, ["date", "date operation", "date opération"]);
    descIdx = findColumnIndex(header, ["libelle", "libellé", "description", "operation", "opération"]);
    amountIdx = findColumnIndex(header, ["montant"]);
    debitIdx = findColumnIndex(header, ["debit", "débit"]);
    creditIdx = findColumnIndex(header, ["credit", "crédit"]);
    dataRows = rows.slice(1);
  } else if (rows[0].length >= 3) {
    // Pas d'en-tete detecte : on suppose Date, Libelle, Montant.
    amountIdx = 2;
  } else {
    // Format libre "libelle montant" par ligne.
    for (const line of lines) {
      const match = line.match(/^(.*?)(-?\d+(?:[.,]\d{1,2})?)\s*€?$/);
      if (!match) {
        skippedUnparsable++;
        continue;
      }
      const description = match[1].trim() || "Dépense";
      const amount = parseAmount(match[2]);
      if (amount === null) {
        skippedUnparsable++;
        continue;
      }
      if (amount >= 0) {
        skippedCredits++;
        continue;
      }
      if (isInternalTransfer(description, ownAccountNames)) {
        skippedTransfers++;
        continue;
      }
      transactions.push({ date: "", description, amount: Math.abs(amount) });
    }
    return buildResult(transactions, skippedCredits, skippedUnparsable, skippedTransfers);
  }

  for (const row of dataRows) {
    if (row.length === 1 && row[0] === "") continue;
    const description = descIdx >= 0 ? row[descIdx] ?? "" : row.slice(1).join(" ");
    const date = dateIdx >= 0 ? row[dateIdx] ?? "" : "";

    let amount: number | null = null;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? row[debitIdx] : "";
      const creditRaw = creditIdx >= 0 ? row[creditIdx] : "";
      if (debitRaw && debitRaw.trim() !== "") {
        const parsed = parseAmount(debitRaw);
        amount = parsed === null ? null : -Math.abs(parsed);
      } else if (creditRaw && creditRaw.trim() !== "") {
        const parsed = parseAmount(creditRaw);
        amount = parsed === null ? null : Math.abs(parsed);
      }
    } else if (amountIdx >= 0) {
      amount = parseAmount(row[amountIdx] ?? "");
    }

    if (amount === null || !description) {
      skippedUnparsable++;
      continue;
    }
    if (amount >= 0) {
      skippedCredits++;
      continue;
    }
    if (isInternalTransfer(description, ownAccountNames)) {
      skippedTransfers++;
      continue;
    }
    transactions.push({ date, description, amount: Math.abs(amount) });
  }

  return buildResult(transactions, skippedCredits, skippedUnparsable, skippedTransfers);
}

function buildResult(transactions: ParsedTransaction[], skippedCredits: number, skippedUnparsable: number, skippedTransfers: number): ParseResult {
  const groups = new Map<string, ImportGroup>();
  for (const tx of transactions) {
    const key = normalizeMerchant(tx.description);
    let group = groups.get(key);
    if (!group) {
      const suggestion = suggestCategory(tx.description);
      group = {
        merchantKey: key,
        suggestedPoste: suggestion.poste,
        suggestedCategory: suggestion.category,
        transactions: [],
        total: 0,
      };
      groups.set(key, group);
    }
    group.transactions.push(tx);
    group.total += tx.amount;
  }

  return {
    groups: [...groups.values()].sort((a, b) => b.total - a.total),
    skippedCredits,
    skippedUnparsable,
    skippedTransfers,
  };
}

const NOISE_PREFIXES = /^(CB|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|ACHAT|PAIEMENT|TPE)\s+/i;

function normalizeMerchant(description: string): string {
  let cleaned = description.toUpperCase();
  cleaned = cleaned.replace(NOISE_PREFIXES, "").replace(NOISE_PREFIXES, "");
  cleaned = cleaned.replace(/\b\d{2}[/.-]\d{2}([/.-]\d{2,4})?\b/g, "");
  cleaned = cleaned.replace(/\b\d{4,}\b/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned || description.trim().toUpperCase();
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

interface CategoryRule {
  keywords: string[];
  poste: string;
  category: BudgetCategory;
}

const CATEGORY_RULES: CategoryRule[] = [
  { keywords: ["carrefour", "leclerc", "auchan", "monoprix", "intermarche", "lidl", "franprix", "casino", "biocoop", "supermarche", "spar", "u express"], poste: "Alimentation", category: "BESOINS" },
  { keywords: ["edf", "engie", "veolia", "eau de paris", "syndic", "loyer"], poste: "Logement", category: "BESOINS" },
  { keywords: ["orange", "sfr", "free mobile", "free telecom", "bouygues telecom", "sosh"], poste: "Télécom", category: "BESOINS" },
  { keywords: ["sncf", "ratp", "navigo", "total energies", "totalenergies", "esso", "shell", "bp "], poste: "Transport", category: "BESOINS" },
  { keywords: ["pharmacie", "docteur", "medecin", "mutuelle", "hopital"], poste: "Santé", category: "BESOINS" },
  { keywords: ["assurance"], poste: "Assurance", category: "BESOINS" },
  { keywords: ["netflix", "spotify", "deezer", "disney", "amazon prime", "canal+", "canalplay"], poste: "Abonnements", category: "ENVIES" },
  { keywords: ["restaurant", "mcdonald", "burger", "deliveroo", "uber eats", "kfc", "brasserie", "cafe"], poste: "Restauration", category: "ENVIES" },
  { keywords: ["amazon", "zalando", "fnac", "decathlon", "zara", "h&m", "cdiscount"], poste: "Shopping", category: "ENVIES" },
  { keywords: ["cinema", "cinéma", "salle de sport", "fitness", "concert"], poste: "Loisirs", category: "ENVIES" },
  { keywords: ["livret", "epargne", "épargne", "pea", "assurance vie"], poste: "Épargne", category: "EPARGNE" },
];

function suggestCategory(description: string): { poste: string; category: BudgetCategory } {
  const lower = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { poste: rule.poste, category: rule.category };
    }
  }
  const merchant = normalizeMerchant(description);
  return { poste: titleCase(merchant) || "Autre", category: "ENVIES" };
}
