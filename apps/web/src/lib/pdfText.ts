/**
 * Extrait le texte d'un PDF (relevé bancaire exporté en PDF) page par page,
 * pour le faire ensuite passer par le meme parseur que le texte colle/CSV.
 * pdfjs-dist est charge dynamiquement : c'est une grosse librairie qui ne
 * doit peser sur le bundle principal que si l'utilisateur importe un PDF.
 */
export async function extractPdfText(file: File): Promise<string> {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
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
