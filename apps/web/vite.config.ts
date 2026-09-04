import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  worker: {
    // Le wrapper pdfWorkerEntry.ts importe pdf.worker.min.mjs dynamiquement :
    // le format "iife" par défaut ne supporte pas le code-splitting.
    format: "es",
  },
});
