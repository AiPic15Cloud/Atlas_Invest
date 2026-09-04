/**
 * Extrait le contenu d'un classeur Excel (.xlsx/.xls) sous forme de texte
 * (une ligne par ligne de feuille, colonnes séparées par ";"), pour le faire
 * ensuite passer par le même parseur que le texte collé/CSV. xlsx est chargé
 * dynamiquement pour ne peser sur le bundle principal que si l'utilisateur
 * importe un fichier Excel.
 */
export async function extractExcelText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    for (const row of rows) {
      const line = row.map((cell) => String(cell ?? "").trim()).join(";");
      if (line.replace(/;/g, "").trim()) lines.push(line);
    }
  }

  return lines.join("\n");
}
