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
  | "awaiting_evidence"
  | "quality_review"
  | "replanning"
  | "blocked"
  | "completed"
  | "completed_with_caveats"
  | "failed"
  | "cancelled"
  | "archived";

// Estado de uma solicitação (Fase 3 — persistência de conversa/solicitação):
// espelha o `check` constraint de solicitacoes em
// supabase/migrations/0009_conversas_solicitacoes.sql.
export type SolicitacaoStatus =
  | "received"
  | "transcribing"
  | "understanding"
  | "awaiting_context"
  | "planned"
  | "confirmed"
  | "converted_to_mission"
  | "archived"
  | "failed";

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
  running: ["blocked", "completed", "failed", "awaiting_approval", "quality_review", "awaiting_evidence"],
  // Espera por prova/insumo externo antes de continuar a etapa (ex: peça que
  // depende de arquivo do cliente). Ainda não é disparado automaticamente por
  // nenhum agente especialista hoje — disponível pra uso futuro/manual.
  awaiting_evidence: ["running", "blocked", "cancelled"],
  // Checkpoint antes de fechar a missão: todas as etapas terminaram, mas a
  // confiança/qualidade agregada pede revisão antes de declarar sucesso.
  quality_review: ["completed", "completed_with_caveats", "replanning"],
  // Falha ou bloqueio que precisa de um novo plano (não só um retry da mesma
  // etapa) — volta pra "planned" pra o Mission Orchestrator gerar novas etapas.
  replanning: ["planned", "cancelled"],
  blocked: ["queued", "awaiting_approval", "cancelled", "failed", "replanning"],
  completed: ["archived"],
  // Concluída, mas com ressalvas registradas (ex: uma etapa terminou com baixa
  // confiança) — terminal como completed, só não finge que saiu perfeita.
  completed_with_caveats: ["archived"],
  failed: ["archived", "queued", "replanning"],
  cancelled: ["archived"],
  archived: [],
};

export const STEP_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  // "awaiting_approval" a partir de "pending" é o caminho normal para etapas
  // de risco alto/crítico: o Policy Engine barra a execução antes mesmo dela
  // começar (processarPlanMission), não só no meio de uma etapa já rodando.
  pending: ["ready", "awaiting_approval", "blocked", "cancelled", "skipped"],
  ready: ["running", "cancelled"],
  running: ["awaiting_approval", "completed", "failed", "blocked"],
  awaiting_approval: ["ready", "cancelled", "blocked"],
  completed: [],
  blocked: ["ready", "cancelled"],
  failed: ["ready", "cancelled"],
  skipped: [],
  cancelled: [],
};

export const SOLICITACAO_TRANSITIONS: Record<SolicitacaoStatus, SolicitacaoStatus[]> = {
  received: ["transcribing", "understanding", "failed"],
  transcribing: ["understanding", "failed"],
  understanding: ["awaiting_context", "planned", "failed"],
  awaiting_context: ["understanding", "archived"],
  planned: ["confirmed", "archived"],
  confirmed: ["converted_to_mission"],
  converted_to_mission: ["archived"],
  failed: ["archived"],
  archived: [],
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

export function transicionarSolicitacao(atual: SolicitacaoStatus, proximo: SolicitacaoStatus): SolicitacaoStatus {
  if (!SOLICITACAO_TRANSITIONS[atual]?.includes(proximo)) {
    throw new TransicaoInvalidaError("solicitação", atual, proximo);
  }
  return proximo;
}
