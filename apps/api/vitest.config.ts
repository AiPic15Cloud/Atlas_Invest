import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // N'exécute que les tests source ; exclut dist/ (build compilé, qui
    // peut contenir d'anciens .test.js tant qu'un ancien build traîne).
    include: ["src/**/*.test.ts"],
  },
});
