/**
 * Extrait le texte d'une image (photo ou scan d'un relevé/reçu) par
 * reconnaissance optique de caractères (OCR), pour le faire ensuite passer
 * par le même parseur que le texte collé/CSV. tesseract.js est chargé
 * dynamiquement pour ne peser sur le bundle principal que si l'utilisateur
 * importe une image. Le worker, le moteur WASM et les données de langue
 * française sont servis depuis /tesseract (dossier public) plutôt que
 * depuis un CDN externe, pour ne pas dépendre d'un service tiers.
 */
export async function extractImageText(file: File, onProgress?: (ratio: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra", undefined, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    logger: onProgress
      ? (m) => {
          if (m.status === "recognizing text") onProgress(m.progress);
        }
      : undefined,
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
