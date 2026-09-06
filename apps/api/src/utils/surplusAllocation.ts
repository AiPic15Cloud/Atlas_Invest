// Proposition d'affectation du surplus mensuel entre objectifs classés par
// priorité (sections 20-21) : Atlas propose une répartition, il n'exécute
// jamais de virement automatiquement.
export interface SurplusGoal {
  id: string;
  remaining: number;
  monthlyContribution: number | null;
}

export interface SurplusAllocationLine {
  goalId: string;
  amount: number;
}

export interface SurplusAllocationResult {
  allocations: SurplusAllocationLine[];
  leftover: number;
}

// `goals` doit deja etre trie par priorite (le plus prioritaire en premier) ;
// cette fonction ne trie pas elle-meme, pour rester une simple regle de
// remplissage sequentiel plutot que decider ce qu'est "la priorite".
export function computeSurplusAllocation(available: number, goals: SurplusGoal[]): SurplusAllocationResult {
  let remaining = Math.max(available, 0);
  const allocations: SurplusAllocationLine[] = [];

  for (const goal of goals) {
    if (remaining <= 0) break;
    if (goal.remaining <= 0) continue;

    const cap = goal.monthlyContribution !== null ? Math.min(goal.monthlyContribution, goal.remaining) : goal.remaining;
    const amount = Math.round(Math.min(cap, remaining) * 100) / 100;
    if (amount > 0) {
      allocations.push({ goalId: goal.id, amount });
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
  }

  return { allocations, leftover: remaining };
}
