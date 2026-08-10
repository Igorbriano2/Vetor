import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type AgenteId =
  | "geral"
  | "secretario"
  | "growth"
  | "estrategia"
  | "trafego"
  | "social-media"
  | "design"
  | "video"
  | "analitico";

// Fase em que cada agente entra em operação — ver docs/06-plano-de-execucao-comandos-claude-code.md
export const FASE_POR_AGENTE: Record<AgenteId, 1 | 2 | 3 | 4> = {
  secretario: 1,
  geral: 2,
  design: 2,
  trafego: 2,
  estrategia: 3,
  growth: 3,
  "social-media": 3,
  analitico: 3,
  video: 4,
};

const cache = new Map<AgenteId, string>();

export function getSystemPrompt(agente: AgenteId): string {
  if (cache.has(agente)) return cache.get(agente)!;
  const prompt = readFileSync(join(__dirname, `${agente}.md`), "utf-8");
  cache.set(agente, prompt);
  return prompt;
}
