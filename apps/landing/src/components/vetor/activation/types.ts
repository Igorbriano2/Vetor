export type VetorOperationState =
  | "closed"
  | "activating"
  | "expanding"
  | "operating"
  | "diagnostic_ready"
  | "closing";

export type VetorOperationStep =
  | "command_received"
  | "context_loaded"
  | "signals_analyzed"
  | "agents_coordinated"
  | "opportunities_found"
  | "result_ready";

export const OPERATION_STEPS: VetorOperationStep[] = [
  "command_received",
  "context_loaded",
  "signals_analyzed",
  "agents_coordinated",
  "opportunities_found",
  "result_ready",
];

export const STEP_META: Record<
  VetorOperationStep,
  { index: string; status: string; statusEn: string; timeline: string }
> = {
  command_received: {
    index: "00",
    status: "COMANDO RECEBIDO",
    statusEn: "COMMAND RECEIVED",
    timeline: "Comando recebido",
  },
  context_loaded: {
    index: "01",
    status: "CONTEXTO RECEBIDO",
    statusEn: "CONTEXT RECEIVED",
    timeline: "Contexto recebido",
  },
  signals_analyzed: {
    index: "02",
    status: "ANALISANDO SINAIS",
    statusEn: "ANALYZING SIGNALS",
    timeline: "Sinais de mercado analisados",
  },
  agents_coordinated: {
    index: "03",
    status: "COORDENANDO ESPECIALISTAS",
    statusEn: "COORDINATING SPECIALISTS",
    timeline: "Especialistas coordenados",
  },
  opportunities_found: {
    index: "04",
    status: "ENCONTRANDO OPORTUNIDADES",
    statusEn: "FINDING OPPORTUNITIES",
    timeline: "Oportunidade identificada",
  },
  result_ready: {
    index: "05",
    status: "DIAGNÓSTICO PRONTO",
    statusEn: "DIAGNOSTIC READY",
    timeline: "Diagnóstico preparado",
  },
};

export const STEP_DURATION: Record<VetorOperationStep, number> = {
  command_received: 1100,
  context_loaded: 1700,
  signals_analyzed: 1900,
  agents_coordinated: 2200,
  opportunities_found: 1900,
  result_ready: 0,
};

/** Os 7 especialistas de uma agência de verdade — no VETOR, agentes de IA. */
export const SPECIALISTS = [
  "ESTRATEGISTA",
  "COPYWRITER",
  "DESIGN",
  "SOCIAL MEDIA",
  "EDITOR DE VÍDEO",
  "TRÁFEGO",
  "ATENDENTE",
] as const;

/** Nós visíveis em telas pequenas (rede mais enxuta). */
export const MOBILE_SPECIALISTS = ["ESTRATEGISTA", "COPYWRITER", "DESIGN", "TRÁFEGO"];
