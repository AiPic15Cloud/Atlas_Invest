export class PdfPasswordRequiredError extends Error {}

/**
 * Extrait le texte d'un PDF (relevé bancaire exporté en PDF) page par page,
 * pour le faire ensuite passer par le meme parseur que le texte colle/CSV.
 * pdfjs-dist est charge dynamiquement : c'est une grosse librairie qui ne
 * doit peser sur le bundle principal que si l'utilisateur importe un PDF.
 */
export async function extractPdfText(file: File): Promise<string> {
  // pdfjs-dist utilise Math.sumPrecise (proposition TC39 très récente), absente des
  // navigateurs qui ne l'implémentent pas encore. Sans ce correctif, l'extraction
  // échoue silencieusement sur ces navigateurs avec une UnknownErrorException.
  const mathWithSumPrecise = Math as unknown as { sumPrecise?: (values: number[]) => number };
  if (typeof mathWithSumPrecise.sumPrecise !== "function") {
    mathWithSumPrecise.sumPrecise = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
  }

  const [{ GlobalWorkerOptions, getDocument, PasswordException }, { default: pdfWorkerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    // `?worker&url` : le motif Vite dédié pour bundler ce module (transpilation +
    // import dynamique interne résolu) en un chunk worker séparé, et en obtenir
    // l'URL buildée sous forme de chaîne — nécessaire ici car c'est pdfjs-dist
    // lui-même qui construit le Worker à partir de cette URL, pas nous.
    import("./pdfWorkerEntry.ts?worker&url"),
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await getDocument({ data: buffer }).promise;
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new PdfPasswordRequiredError("Ce PDF est protégé par un mot de passe.");
    }
    throw err;
  }
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    let currentY: number | null = null;
    let currentLine: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (currentY !== null && Math.abs(y - currentY) > 2) {
        lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
        currentLine = [];
      }
      currentY = y;
      if (item.str.trim()) currentLine.push(item.str);
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
    }
  }

  return lines.filter((l) => l.length > 0).join("\n");
}
