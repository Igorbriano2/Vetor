// Chave compartilhada de conversationId — o Command Bar (texto/áudio manual)
// e o assistente de voz por wake word precisam ser a MESMA conversa (nunca
// um histórico paralelo, ver processarMensagemPlataforma). Ambos leem/gravam
// esta mesma entrada de sessionStorage.
export const CHAVE_CONVERSATION_ID = "vetor:conversationId";

export function lerConversationId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(CHAVE_CONVERSATION_ID) ?? undefined;
}

export function salvarConversationId(id: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CHAVE_CONVERSATION_ID, id);
}

// Templates (Fase 4 do upgrade Gravyx) — "usar template" grava o texto
// aqui e navega pro dashboard; o Command Bar lê e PREENCHE o campo (nunca
// envia sozinho — o cliente sempre revisa antes de mandar pro Vetor).
const CHAVE_PREFILL_COMANDO = "vetor:prefillComando";

export function lerEconsumirPrefillComando(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const valor = sessionStorage.getItem(CHAVE_PREFILL_COMANDO);
  if (valor) sessionStorage.removeItem(CHAVE_PREFILL_COMANDO);
  return valor ?? undefined;
}

export function salvarPrefillComando(texto: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CHAVE_PREFILL_COMANDO, texto);
}
