export type FinancingType = "IMMOBILIER" | "CONSOMMATION" | "VOITURE" | "TRAVAUX" | "AUTRE";

export interface FinancingSimulationInput {
  amount: number;
  downPayment: number;
  durationMonths: number;
  interestRatePercent: number | null;
  // undefined = non renseigne (donnee inconnue) ; 0 = explicitement nul.
  // Cette distinction est cruciale pour ne jamais afficher un TAEG comme
  // certain quand une composante obligatoire n'a en realite pas ete
  // renseignee (section 39 : "ne jamais donner une fausse precision").
  insuranceMonthly?: number;
  fees?: number;
}

export interface FinancingSimulationResult {
  financedAmount: number;
  monthlyPayment: number;
  monthlyPaymentWithInsurance: number;
  totalInterest: number;
  totalCost: number;
  taeg: number | null;
  taegUnavailableReason: string | null;
}

function computeAmortizedPayment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

// TAEG estime par methode actuarielle (Newton-Raphson) : on cherche le taux
// periodique r qui annule la valeur actuelle nette des flux -- somme
// empruntee reellement percue (montant finance moins les frais, payes
// d'avance) contre les mensualites (credit + assurance) versees ensuite.
// Volontairement une estimation ("estime"), jamais annoncee comme le TAEG
// legal exact que seul un etablissement bancaire peut certifier.
function computeActuarialMonthlyRate(
  netAmountReceived: number,
  monthlyOutflow: number,
  months: number,
  initialGuess: number,
): number {
  let r = initialGuess;
  for (let i = 0; i < 100; i++) {
    if (r <= -1) r = -0.99;
    let npv = netAmountReceived;
    let dnpv = 0;
    for (let t = 1; t <= months; t++) {
      const discount = Math.pow(1 + r, t);
      npv -= monthlyOutflow / discount;
      dnpv += (t * monthlyOutflow) / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(dnpv) < 1e-9) break;
    const next = r - npv / dnpv;
    if (Math.abs(next - r) < 1e-10) {
      r = next;
      break;
    }
    r = next;
  }
  return r;
}

export function simulateFinancing(input: FinancingSimulationInput): FinancingSimulationResult {
  const financedAmount = Math.max(0, input.amount - input.downPayment);

  if (input.interestRatePercent === null) {
    const monthlyPayment = Math.round((financedAmount / Math.max(1, input.durationMonths)) * 100) / 100;
    return {
      financedAmount: Math.round(financedAmount * 100) / 100,
      monthlyPayment,
      monthlyPaymentWithInsurance: Math.round((monthlyPayment + (input.insuranceMonthly ?? 0)) * 100) / 100,
      totalInterest: 0,
      totalCost: Math.round((monthlyPayment * input.durationMonths + (input.fees ?? 0)) * 100) / 100,
      taeg: null,
      taegUnavailableReason: "TAEG non disponible : taux d'intérêt non renseigné.",
    };
  }

  const monthlyRate = input.interestRatePercent / 100 / 12;
  const monthlyPayment = computeAmortizedPayment(financedAmount, monthlyRate, input.durationMonths);
  const totalInterest = monthlyPayment * input.durationMonths - financedAmount;
  const insurance = input.insuranceMonthly ?? 0;
  const fees = input.fees ?? 0;
  const totalCost = totalInterest + fees + insurance * input.durationMonths;

  let taeg: number | null = null;
  let taegUnavailableReason: string | null = null;

  if (input.insuranceMonthly === undefined || input.fees === undefined) {
    taegUnavailableReason = "TAEG non disponible : assurance et/ou frais non renseignés.";
  } else {
    const netAmountReceived = financedAmount - fees;
    const monthlyOutflow = monthlyPayment + insurance;
    if (netAmountReceived > 0 && monthlyOutflow > 0) {
      const r = computeActuarialMonthlyRate(netAmountReceived, monthlyOutflow, input.durationMonths, monthlyRate);
      taeg = Math.round((Math.pow(1 + r, 12) - 1) * 10000) / 100;
    }
  }

  return {
    financedAmount: Math.round(financedAmount * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    monthlyPaymentWithInsurance: Math.round((monthlyPayment + insurance) * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    taeg,
    taegUnavailableReason,
  };
}
