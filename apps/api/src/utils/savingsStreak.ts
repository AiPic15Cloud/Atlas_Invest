// Streak d'epargne (section 52) : le foyer joue contre son propre historique.
// "Meme une petite epargne peut maintenir la serie" -> tout montant > 0
// compte, pas de seuil minimum. Aucune mecanique punitive : on affiche l'etat
// tel qu'il est, sans animation de "serie brisee" ni pénalité.
export interface MonthlyEpargne {
  year: number;
  month: number;
  amount: number;
}

export interface SavingsStreak {
  currentStreak: number;
  bestStreak: number;
}

// `months` doit etre trie chronologiquement et sans trou (un mois sans
// activite doit apparaitre avec amount = 0, pas etre omis) du premier mois
// d'activite du foyer jusqu'au mois courant inclus.
export function computeSavingsStreak(months: MonthlyEpargne[]): SavingsStreak {
  let bestStreak = 0;
  let running = 0;
  for (const m of months) {
    if (m.amount > 0) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
  }

  let currentStreak = 0;
  for (let i = months.length - 1; i >= 0; i -= 1) {
    if (months[i].amount > 0) currentStreak += 1;
    else break;
  }

  return { currentStreak, bestStreak };
}
