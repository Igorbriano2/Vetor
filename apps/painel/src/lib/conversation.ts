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
