// Provider "browser-speech-fallback" — o único que funciona de verdade em
// produção hoje (ver docs/voice/wake-word-training.md pro porquê dos outros
// dois ainda não terem um modelo "vetor"). Usa a Web Speech API nativa
// (SpeechRecognition/webkitSpeechRecognition) em modo contínuo, observando o
// transcript ao vivo em busca da palavra "vetor".
//
// Isso NÃO é detecção local: o Chrome envia o áudio pros servidores de
// reconhecimento do Google. Por isso a spec trata este provider como
// fallback, não como a solução definitiva — mas hoje é o único caminho sem
// custo e sem modelo treinado que realmente ativa por voz. O usuário só
// entra nesse modo depois de ligar a voz explicitamente (permissão de mic
// pedida uma vez, indicador de microfone sempre visível enquanto ativo).
//
// Falso positivo é esperado (qualquer palavra parecida com "vetor" no meio
// de uma frase pode disparar) — o cooldown e a confirmação sonora curta
// (tocada pelo VetorVoiceProvider) existem justamente pra isso não ser
// silencioso.

import type { WakeWordConfig, WakeWordEngine, WakeWordEvent } from "../types";
import { WakeWordUnavailableError } from "../types";
import { passouCooldown } from "../cooldown";

const COOLDOWN_PADRAO_MS = 2500;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acento — "vetor" não tem, mas o reconhecimento às vezes devolve variação
}

function obterConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export class BrowserSpeechWakeWordEngine implements WakeWordEngine {
  private config: WakeWordConfig | null = null;
  private recognition: SpeechRecognition | null = null;
  private Constructor: SpeechRecognitionConstructor | null = null;
  private ativo = false;
  private pausado = false;
  private ultimaDeteccaoMs = 0;

  private wakeWordListeners = new Set<(event: WakeWordEvent) => void>();
  private speechStartListeners = new Set<() => void>();
  private speechEndListeners = new Set<() => void>();

  async initialize(config: WakeWordConfig): Promise<void> {
    const Constructor = obterConstructor();
    if (!Constructor) {
      throw new WakeWordUnavailableError(
        "browser-speech-fallback",
        "SpeechRecognition/webkitSpeechRecognition não existe neste navegador (ex: Firefox sem a flag habilitada).",
      );
    }
    this.Constructor = Constructor;
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.Constructor || !this.config) {
      throw new Error("BrowserSpeechWakeWordEngine.start() chamado antes de initialize().");
    }
    this.ativo = true;
    this.pausado = false;
    this.iniciarSessaoDeReconhecimento();
  }

  async pause(): Promise<void> {
    this.pausado = true;
    // Corta o reconhecimento de verdade (não só uma flag) — nunca deixa o
    // navegador continuar mandando áudio pro reconhecimento enquanto o
    // VETOR está falando (evita o assistente "ouvir" a própria resposta).
    this.recognition?.abort();
    this.recognition = null;
  }

  async stop(): Promise<void> {
    this.ativo = false;
    this.pausado = false;
    this.recognition?.abort();
    this.recognition = null;
  }

  onWakeWord(callback: (event: WakeWordEvent) => void): () => void {
    this.wakeWordListeners.add(callback);
    return () => this.wakeWordListeners.delete(callback);
  }

  onSpeechStart(callback: () => void): () => void {
    this.speechStartListeners.add(callback);
    return () => this.speechStartListeners.delete(callback);
  }

  onSpeechEnd(callback: () => void): () => void {
    this.speechEndListeners.add(callback);
    return () => this.speechEndListeners.delete(callback);
  }

  private iniciarSessaoDeReconhecimento(): void {
    if (!this.Constructor || !this.ativo || this.pausado) return;

    const recognition = new this.Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultado = event.results[i];
        const transcript = resultado[0]?.transcript ?? "";
        this.avaliarTranscript(transcript, resultado[0]?.confidence ?? 0.5);
      }
    };

    recognition.onspeechstart = () => {
      for (const cb of this.speechStartListeners) cb();
    };

    recognition.onspeechend = () => {
      for (const cb of this.speechEndListeners) cb();
    };

    recognition.onerror = (event) => {
      // "no-speech"/"aborted" são esperados no loop normal de restart —
      // qualquer outro erro só é logado (nunca trava o app).
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn(`[voice] SpeechRecognition erro: ${event.error} — ${event.message}`);
      }
    };

    // O Chrome encerra a sessão sozinho após um período de silêncio/tempo —
    // reinicia automaticamente enquanto o engine deveria estar ativo. Sem
    // isso, "contínuo" para de verdade depois de ~1 minuto.
    recognition.onend = () => {
      if (this.recognition === recognition && this.ativo && !this.pausado) {
        this.iniciarSessaoDeReconhecimento();
      }
    };

    this.recognition = recognition;
    recognition.start();
  }

  private avaliarTranscript(transcript: string, confidence: number): void {
    if (!this.config) return;
    const texto = normalizar(transcript);
    const palavraChave = normalizar(this.config.keyword);
    if (!texto.includes(palavraChave)) return;

    const agora = Date.now();
    const cooldown = this.config.cooldownMs ?? COOLDOWN_PADRAO_MS;
    if (!passouCooldown(this.ultimaDeteccaoMs, agora, cooldown)) return; // mesma detecção reaparecendo em resultados intermediários
    this.ultimaDeteccaoMs = agora;

    const evento: WakeWordEvent = { keyword: this.config.keyword, confidence, timestampMs: agora };
    for (const cb of this.wakeWordListeners) cb(evento);
  }
}
