// Assistente de voz do VETOR — tipos base. O app nunca fala diretamente com
// um SDK de wake word: sempre passa pela interface WakeWordEngine, provida
// por um dos providers em ./providers/*. Isso existe pra poder trocar o
// provider (mock -> browser-speech-fallback -> openwakeword-wasm ->
// porcupine-web) sem tocar em nenhum componente React ou no pipeline de
// missões. Ver docs/voice/wake-word-training.md pro estado real de cada
// provider (nenhum tem hoje um modelo "VETOR" pronto pra produção, exceto o
// fallback do navegador, que não é detecção local de verdade).

export type WakeWordProvider = "mock" | "openwakeword-wasm" | "porcupine-web" | "browser-speech-fallback";

export interface WakeWordConfig {
  // Palavra-chave proprietária do produto — sempre "vetor" (case-insensitive
  // na comparação interna de cada provider). Nunca "jarvis" ou nome de
  // terceiro.
  keyword: "vetor";
  // Sensibilidade 0..1 — quanto maior, mais fácil disparar (mais falso
  // positivo); quanto menor, mais difícil (mais falso negativo). Só faz
  // sentido pra providers com modelo real (openwakeword-wasm/porcupine-web);
  // o fallback do navegador ignora este campo.
  sensitivity?: number;
  // Janela de silêncio (ms) que encerra a captura da solicitação após a
  // wake word — ver VetorVoiceProvider.
  silenceTimeoutMs?: number;
  // Teto absoluto (ms) de captura da solicitação, mesmo sem silêncio —
  // nunca grava pra sempre.
  maxRequestDurationMs?: number;
  // Tempo mínimo (ms) entre duas detecções válidas — evita disparo duplo do
  // mesmo "vetor" falado uma vez.
  cooldownMs?: number;
}

export interface WakeWordEvent {
  keyword: string;
  confidence: number;
  timestampMs: number;
}

// Contrato único que todo provider implementa — nunca exposto ao componente
// React diretamente, sempre através de VetorVoiceProvider.
export interface WakeWordEngine {
  initialize(config: WakeWordConfig): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  onWakeWord(callback: (event: WakeWordEvent) => void): () => void;
  onSpeechStart(callback: () => void): () => void;
  onSpeechEnd(callback: () => void): () => void;
}

// Erro fail-closed: um provider que não tem modelo/licença pronta lança isso
// em initialize() em vez de fingir que a detecção funciona. Nunca capturado
// silenciosamente — VetorVoiceProvider trata isso como "unsupported" e cai
// pro próximo provider da ordem de fallback (ver selectProvider.ts).
export class WakeWordUnavailableError extends Error {
  constructor(
    public readonly provider: WakeWordProvider,
    reason: string,
  ) {
    super(`Provider "${provider}" indisponível: ${reason}`);
    this.name = "WakeWordUnavailableError";
  }
}

// Máquina de estados do assistente de voz — cobre desde a ausência de
// permissão até a fala da resposta. Ver stateMachine.ts pras transições
// válidas entre estes estados (nunca um componente seta estado livremente).
export type VoiceState =
  | "disabled" // voz nunca foi ligada nesta sessão (padrão ao carregar)
  | "permission_required" // usuário ligou a voz, mic ainda não foi autorizado
  | "requesting_permission" // getUserMedia() em andamento
  | "permission_denied" // usuário negou a permissão do navegador
  | "unsupported" // navegador/ambiente sem suporte a nenhum provider real
  | "standby" // permissão ok, engine rodando, esperando "vetor"
  | "wake_word_detected" // "vetor" acabou de ser detectado, prestes a capturar
  | "listening_request" // capturando a fala da solicitação
  | "transcribing" // solicitação capturada, aguardando transcrição/backend
  | "thinking" // backend processando (núcleo VETOR entendendo/planejando)
  | "speaking" // reproduzindo a resposta em TTS
  | "paused_by_browser" // aba perdeu foco/mic foi revogado no meio da sessão
  | "error"; // falha recuperável — volta pra standby quando possível

export interface VoiceTelemetryEvent {
  type:
    | "permission_granted"
    | "permission_denied"
    | "engine_started"
    | "engine_unavailable"
    | "wake_word_detected"
    | "false_positive_suspected"
    | "request_captured"
    | "request_sent"
    | "response_received"
    | "error";
  provider: WakeWordProvider;
  timestampMs: number;
  detail?: string;
}
