// Un poste qui revient chaque mois avec un montant stable n'est pas
// forcement un abonnement : le loyer, un virement d'epargne programme, ou
// meme des courses/restaurants dont le montant reste proche d'un mois sur
// l'autre par coincidence, partagent la meme signature statistique qu'un
// vrai abonnement (Netflix, salle de sport...). On exclut explicitement ces
// categories de depenses de vie courante, quitte a rater un vrai abonnement
// dont le libelle contient un de ces mots (ex. "Box Courses Bio") : mieux
// vaut un faux negatif ponctuel qu'une liste d'abonnements polluee par du
// bruit connu (limite documentee au Lot 24, corrigee ici).
//
// Les mots-cles sont volontairement sans accent : \b en JavaScript ne
// reconnait pas les lettres accentuees comme des caracteres de mot, donc une
// frontiere juste apres un "e" accentue (ex. "marche" avec accent suivi d'un
// espace) ne matcherait jamais. On normalise le poste (accents retires via
// NFD + suppression des marques combinantes ̀-ͯ) avant de tester,
// plutot que de dupliquer chaque mot-cle en version accentuee.
const EXCLUDED_FROM_SUBSCRIPTION_DETECTION =
  /\b(loyer|virement\s*epargne|courses?|supermarche|marche|epicerie|boulangerie|restaurant|boucherie|primeur)\b/i;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function isExcludedFromSubscriptionDetection(poste: string): boolean {
  return EXCLUDED_FROM_SUBSCRIPTION_DETECTION.test(stripDiacritics(poste));
}
