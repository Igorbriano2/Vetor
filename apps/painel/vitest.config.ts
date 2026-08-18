import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Só testa lógica pura (máquina de estados de voz, detector de silêncio,
// seleção de provider, mock engine) — mesma convenção de apps/agentes: nada
// de mock de DOM/mic/rede. Ambiente "node" (não jsdom) de propósito, pra
// nunca dar a falsa impressão de que testamos captura de áudio real.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
