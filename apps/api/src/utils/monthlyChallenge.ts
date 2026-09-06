// Défi mensuel d'épargne du foyer (section 51) : l'avancement se base
// uniquement sur de l'épargne réellement enregistrée (jamais une intention),
// jamais sur une compétition entre membres du foyer.
export interface ChallengeProgress {
  saved: number;
  remaining: number;
  achieved: boolean;
  stretchReached: boolean;
}

export function computeChallengeProgress(
  targetAmount: number,
  stretchGoalAmount: number | null,
  saved: number,
): ChallengeProgress {
  return {
    saved,
    remaining: Math.max(targetAmount - saved, 0),
    achieved: saved >= targetAmount,
    stretchReached: stretchGoalAmount !== null && saved >= stretchGoalAmount,
  };
}
