// Mensualite soutenable (section 46) : classe la mensualite totale
// (credit + assurance) d'un projet dans une zone, avec les seuils
// litteraux de la spec -- jamais calcules a partir du taux d'effort
// (% du revenu), qui varierait la classification d'un meme montant selon
// le revenu du foyer alors que la spec est explicite : "les seuils sont
// issus du profil financier reel, pas uniquement du taux d'effort."
export type SustainablePaymentZone = "CONFORTABLE" | "INTERMEDIAIRE" | "TENDU" | "TRES_CONTRAINT";

const ZONE_MAX_BOUNDS: { zone: SustainablePaymentZone; max: number }[] = [
  { zone: "CONFORTABLE", max: 300 },
  { zone: "INTERMEDIAIRE", max: 450 },
  { zone: "TENDU", max: 550 },
];

export function classifySustainableMonthlyPayment(monthlyPaymentWithInsurance: number): SustainablePaymentZone {
  for (const bound of ZONE_MAX_BOUNDS) {
    if (monthlyPaymentWithInsurance <= bound.max) return bound.zone;
  }
  return "TRES_CONTRAINT";
}

// Capacite immobiliere (section 47) : plutot qu'un chiffre unique qui
// inventerait une precision que le calendrier des taux ne garantit pas,
// une fourchette par zone -- le montant total empruntable (financement +
// apport) qui produirait une mensualite a la limite basse et a la limite
// haute de chaque zone, a taux/duree/assurance fixes.
export interface CapacityInput {
  downPayment: number;
  durationMonths: number;
  interestRatePercent: number | null;
  insuranceMonthly: number;
}

export interface CapacityRange {
  zone: SustainablePaymentZone;
  minAmount: number;
  // null = zone "Tres contraint", dont la borne haute n'est pas plafonnee
  // par la spec (au-dela de 550 €, il n'y a plus de limite definie).
  maxAmount: number | null;
}

const ZONE_UPPER_PAYMENT_BOUNDS: { zone: SustainablePaymentZone; upperPayment: number | null }[] = [
  { zone: "CONFORTABLE", upperPayment: 300 },
  { zone: "INTERMEDIAIRE", upperPayment: 450 },
  { zone: "TENDU", upperPayment: 550 },
  { zone: "TRES_CONTRAINT", upperPayment: null },
];

// Inverse la formule d'annuite (mensualite -> capital) : pour un taux et une
// duree fixes, la mensualite de credit est directement proportionnelle au
// capital finance, donc l'inversion est une simple division par le meme
// facteur d'annuite utilise par simulateFinancing.
function financedAmountForCreditPayment(creditPayment: number, monthlyRate: number | null, months: number): number {
  if (creditPayment <= 0 || months <= 0) return 0;
  if (monthlyRate === null || monthlyRate === 0) return creditPayment * months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (creditPayment * (factor - 1)) / (monthlyRate * factor);
}

// Arrondi au millier pour eviter d'afficher une fausse precision
// (ex. "230 483,27 €") sur un montant qui reste une estimation.
function roundToThousand(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}

export function computePurchaseCapacityRanges(input: CapacityInput): CapacityRange[] {
  const monthlyRate = input.interestRatePercent === null ? null : input.interestRatePercent / 100 / 12;

  function totalAmountAtPayment(totalMonthlyPayment: number): number {
    const creditPayment = Math.max(0, totalMonthlyPayment - input.insuranceMonthly);
    const financedAmount = financedAmountForCreditPayment(creditPayment, monthlyRate, input.durationMonths);
    return roundToThousand(financedAmount + input.downPayment);
  }

  let previousUpper = 0;
  return ZONE_UPPER_PAYMENT_BOUNDS.map(({ zone, upperPayment }) => {
    const minAmount = previousUpper === 0 ? roundToThousand(input.downPayment) : totalAmountAtPayment(previousUpper);
    const maxAmount = upperPayment === null ? null : totalAmountAtPayment(upperPayment);
    if (upperPayment !== null) previousUpper = upperPayment;
    return { zone, minAmount, maxAmount };
  });
}
