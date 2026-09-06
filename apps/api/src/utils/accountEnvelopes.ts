// Enveloppes virtuelles (spec section 18) : réserver mentalement une
// partie du solde d'un compte sans déplacement bancaire réel. Le total des
// enveloppes ne doit jamais dépasser le solde réellement disponible — et
// si c'est le cas, jamais le cacher silencieusement (garde-fou section 78).
export function computeEnvelopeSummary(
  balance: number,
  envelopeAmounts: number[],
): { allocated: number; free: number; overAllocated: boolean } {
  const allocated = Math.round(envelopeAmounts.reduce((sum, a) => sum + a, 0) * 100) / 100;
  const free = Math.round((balance - allocated) * 100) / 100;
  return { allocated, free, overAllocated: free < 0 };
}
