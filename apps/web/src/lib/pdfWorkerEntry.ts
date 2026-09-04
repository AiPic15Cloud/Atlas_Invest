// Point d'entrée du worker pdf.js. Le vrai worker (pdf.worker.min.mjs) tourne dans
// son propre contexte global (Worker), qui ne partage pas le `Math` du thread
// principal : le correctif appliqué dans pdfText.ts ne suffit donc pas ici. On
// applique le même correctif dans ce contexte avant de charger le vrai worker.
const mathWithSumPrecise = Math as unknown as { sumPrecise?: (values: number[]) => number };
if (typeof mathWithSumPrecise.sumPrecise !== "function") {
  mathWithSumPrecise.sumPrecise = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
}

import("pdfjs-dist/build/pdf.worker.min.mjs");
