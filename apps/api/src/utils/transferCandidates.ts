// Detection de virements internes mal saisis comme depense + revenu
// separes (spec section 9, garde-fou section 78 : "ne jamais compter un
// transfert comme un revenu ou une depense"). Purement une suggestion :
// aucune conversion automatique, l'utilisateur valide ou ecarte chaque cas.
export interface CandidateExpense {
  id: string;
  bankAccountId: string;
  year: number;
  month: number;
  amount: number;
}

export interface CandidateIncome {
  id: string;
  bankAccountId: string;
  year: number;
  month: number;
  amount: number;
}

export interface TransferCandidate {
  expenseId: string;
  incomeId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  year: number;
  month: number;
}

// Appariement glouton 1-1 par (annee, mois, montant) entre une depense et
// un revenu de comptes differents : chaque depense/revenu n'est utilise
// que dans au plus un appariement, pour ne jamais sur-compter un candidat
// quand plusieurs dépenses/revenus partagent le même montant.
export function findTransferCandidates(
  expenses: CandidateExpense[],
  incomes: CandidateIncome[],
): TransferCandidate[] {
  const key = (year: number, month: number, amount: number) => `${year}-${month}-${Math.round(amount * 100)}`;

  const incomesByKey = new Map<string, CandidateIncome[]>();
  for (const income of incomes) {
    const k = key(income.year, income.month, income.amount);
    const list = incomesByKey.get(k) ?? [];
    list.push(income);
    incomesByKey.set(k, list);
  }

  const candidates: TransferCandidate[] = [];
  for (const expense of expenses) {
    const k = key(expense.year, expense.month, expense.amount);
    const pool = incomesByKey.get(k);
    if (!pool) continue;

    const matchIndex = pool.findIndex((income) => income.bankAccountId !== expense.bankAccountId);
    if (matchIndex === -1) continue;

    const [income] = pool.splice(matchIndex, 1);
    candidates.push({
      expenseId: expense.id,
      incomeId: income.id,
      fromAccountId: expense.bankAccountId,
      toAccountId: income.bankAccountId,
      amount: expense.amount,
      year: expense.year,
      month: expense.month,
    });
  }

  return candidates;
}
