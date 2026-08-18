// Máquina de estados do assistente de voz — mesma postura de
// apps/agentes/src/missions/stateMachine.ts: toda troca de VoiceState passa
// por transicionarVoz(), nunca um setState livre num componente. Pura, sem
// I/O, testável sem mockar mic/engine nenhum.

import type { VoiceState } from "./types";

export class TransicaoVozInvalidaError extends Error {
  constructor(atual: VoiceState, proximo: VoiceState) {
    super(`Transição inválida de voz: "${atual}" -> "${proximo}"`);
    this.name = "TransicaoVozInvalidaError";
  }
}

export const VOICE_TRANSITIONS: Record<VoiceState, VoiceState[]> = {
  disabled: ["permission_required", "unsupported"],
  permission_required: ["requesting_permission", "disabled"],
  requesting_permission: ["standby", "permission_denied", "unsupported", "error", "disabled"],
  permission_denied: ["requesting_permission", "disabled"],
  unsupported: ["disabled"],
  standby: ["wake_word_detected", "paused_by_browser", "error", "disabled"],
  wake_word_detected: ["listening_request", "standby", "error", "disabled"],
  listening_request: ["transcribing", "standby", "error", "disabled"],
  transcribing: ["thinking", "error", "disabled"],
  thinking: ["speaking", "standby", "error", "disabled"],
  speaking: ["standby", "error", "disabled"],
  paused_by_browser: ["standby", "permission_denied", "disabled"],
  error: ["standby", "disabled"],
};

// Fail-closed: transição fora do grafo lança, nunca aplica silenciosamente
// (mesmo raciocínio do Mission Orchestrator — "nunca confiar em estado
// vindo de um clique/callback sem validar a transição real").
export function transicionarVoz(atual: VoiceState, proximo: VoiceState): VoiceState {
  const permitidas = VOICE_TRANSITIONS[atual];
  if (!permitidas.includes(proximo)) {
    throw new TransicaoVozInvalidaError(atual, proximo);
  }
  return proximo;
}

export function podeTransicionar(atual: VoiceState, proximo: VoiceState): boolean {
  return VOICE_TRANSITIONS[atual].includes(proximo);
}

// Estados em que o núcleo/engine está realmente ativo escutando ou
// processando — usado pra decidir se o indicador visual mostra "voz
// disponível" vs. os estados de configuração/erro que não são o dia a dia.
export const ESTADOS_ATIVOS: VoiceState[] = [
  "standby",
  "wake_word_detected",
  "listening_request",
  "transcribing",
  "thinking",
  "speaking",
];
