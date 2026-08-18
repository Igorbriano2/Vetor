// Provider mock — nunca acessa microfone/rede. Serve dois propósitos:
// (1) testes automatizados do VetorVoiceProvider e da máquina de estados,
// disparando eventos de forma determinística; (2) um "gatilho manual" de
// desenvolvimento (ex: botão "simular 'vetor'" nas ferramentas de dev) pra
// testar o fluxo completo antes de existir um modelo real treinado.
//
// Nunca é selecionado automaticamente em produção (ver selectProvider.ts) —
// só via override explícito de config/URL de teste.

import type { WakeWordConfig, WakeWordEngine, WakeWordEvent } from "../types";

export class MockWakeWordEngine implements WakeWordEngine {
  private config: WakeWordConfig | null = null;
  private ativo = false;
  private pausado = false;
  private wakeWordListeners = new Set<(event: WakeWordEvent) => void>();
  private speechStartListeners = new Set<() => void>();
  private speechEndListeners = new Set<() => void>();

  async initialize(config: WakeWordConfig): Promise<void> {
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config) throw new Error("MockWakeWordEngine.start() chamado antes de initialize().");
    this.ativo = true;
    this.pausado = false;
  }

  async pause(): Promise<void> {
    this.pausado = true;
  }

  async stop(): Promise<void> {
    this.ativo = false;
    this.pausado = false;
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

  // --- controles de teste/dev, não fazem parte da interface WakeWordEngine ---

  get estaAtivo(): boolean {
    return this.ativo && !this.pausado;
  }

  simularWakeWord(confidence = 0.95): void {
    if (!this.estaAtivo) return;
    const evento: WakeWordEvent = { keyword: this.config?.keyword ?? "vetor", confidence, timestampMs: Date.now() };
    for (const cb of this.wakeWordListeners) cb(evento);
  }

  simularInicioDeFala(): void {
    if (!this.estaAtivo) return;
    for (const cb of this.speechStartListeners) cb();
  }

  simularFimDeFala(): void {
    if (!this.estaAtivo) return;
    for (const cb of this.speechEndListeners) cb();
  }
}
