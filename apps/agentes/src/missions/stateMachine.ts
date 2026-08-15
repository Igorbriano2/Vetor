// Máquina de estados de missão — espelha exatamente os `check` constraints de
// supabase/migrations/0004_missions.sql. Toda escrita de status de missão/etapa
// deve passar por aqui, nunca por uma string solta: o banco rejeita valor
// inválido, isso aqui rejeita transição inválida (defesa em profundidade).
// Ver docs/manus-jarvis-spec/docs/03-arquitetura-tecnica.md, "Ciclo de missão".

export type MissionStatus =
  | "draft"
  | "understanding"
  | "awaiting_clarification"
  | "planned"
  | "awaiting_approval"
  | "queued"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

export type StepStatus =
  | "pending"
  | "ready"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "blocked"
  | "failed"
  | "skipped"
  | "cancelled";

export class TransicaoInvalidaError extends Error {
  constructor(entidade: string, atual: string, proximo: string) {
    super(`Transição inválida de ${entidade}: "${atual}" -> "${proximo}"`);
    this.name = "TransicaoInvalidaError";
  }
}

export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  draft: ["understanding", "cancelled"],
  understanding: ["planned", "awaiting_clarification", "cancelled"],
  awaiting_clarification: ["understanding", "cancelled"],
  planned: ["awaiting_approval", "queued", "cancelled"],
  awaiting_approval: ["queued", "blocked", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["blocked", "completed", "failed", "awaiting_approval"],
  blocked: ["queued", "awaiting_approval", "cancelled", "failed"],
  completed: ["archived"],
  failed: ["archived", "queued"],
  cancelled: ["archived"],
  archived: [],
};

export const STEP_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  pending: ["ready", "blocked", "cancelled", "skipped"],
  ready: ["running", "cancelled"],
  running: ["awaiting_approval", "completed", "failed", "blocked"],
  awaiting_approval: ["ready", "cancelled", "blocked"],
  completed: [],
  blocked: ["ready", "cancelled"],
  failed: ["ready", "cancelled"],
  skipped: [],
  cancelled: [],
};

export function transicionarMissao(atual: MissionStatus, proximo: MissionStatus): MissionStatus {
  if (!MISSION_TRANSITIONS[atual]?.includes(proximo)) {
    throw new TransicaoInvalidaError("missão", atual, proximo);
  }
  return proximo;
}

export function transicionarEtapa(atual: StepStatus, proximo: StepStatus): StepStatus {
  if (!STEP_TRANSITIONS[atual]?.includes(proximo)) {
    throw new TransicaoInvalidaError("etapa", atual, proximo);
  }
  return proximo;
}
