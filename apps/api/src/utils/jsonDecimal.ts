// Un export JSON complet (section 71) traverse des dizaines de modeles
// contenant des champs Decimal (montants). Prisma.Decimal expose un
// toJSON() qui le serialise en chaine ("1234.56") -- JSON.stringify
// l'appelle avant meme qu'un replacer ne voie la valeur, donc un replacer
// classique ne peut pas intercepter le Decimal d'origine. On convertit
// donc l'objet entier AVANT de le serialiser, en Number(x), comme le fait
// deja `Number(x)` partout ailleurs dans l'API -- mais sans devoir
// convertir chaque champ un par un sur des dizaines de modeles.
export function convertDecimals(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(convertDecimals);
  if (typeof value === "object") {
    if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber();
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = convertDecimals(entry);
    }
    return result;
  }
  return value;
}
