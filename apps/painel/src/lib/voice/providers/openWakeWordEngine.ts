// Provider "openwakeword-wasm" — detecção LOCAL de verdade (ONNX Runtime Web
// rodando no navegador, nenhum áudio sai da máquina do cliente). Requer 3
// arquivos .onnx hospedados em /public/wake-word/ (nunca baixados de um CDN
// de terceiro em runtime — ver docs/voice/wake-word-training.md):
//
//   - melspectrogram.onnx  — Google/TFHub, Apache-2.0, comercial ok
//   - embedding_model.onnx — idem, mesma licença
//   - vetor.onnx           — o classificador da palavra "vetor" propriamente
//                            dito, que AINDA NÃO EXISTE nesta rodada (precisa
//                            ser treinado com o pipeline do openWakeWord —
//                            nunca usar um checkpoint pré-treinado de
//                            terceiro tipo "hey_jarvis": esses são licenciados
//                            CC BY-NC-SA 4.0, não comercial).
//
// Sem os 3 arquivos presentes, initialize() falha com WakeWordUnavailableError
// — este provider NUNCA finge que a detecção está funcionando.
//
// PIPELINE NÃO VALIDADO CONTRA PESOS REAIS: a montagem de janela/stacking de
// embeddings abaixo segue a convenção documentada publicamente do
// openWakeWord (chunks de 1280 amostras @ 16kHz = 80ms; pilha de 16 frames de
// embedding antes do classificador). Isso precisa ser conferido de novo
// assim que existir um vetor.onnx real pra testar — ver o TODO explícito no
// final do arquivo.

import type { WakeWordConfig, WakeWordEngine, WakeWordEvent } from "../types";
import { WakeWordUnavailableError } from "../types";
import { passouCooldown } from "../cooldown";

const BASE_PATH = "/wake-word";
const AMOSTRAS_POR_BLOCO = 1280; // 80ms a 16kHz
const FRAMES_EMPILHADOS_NO_EMBEDDING = 16; // janela de contexto padrão do openWakeWord antes do classificador
const SAMPLE_RATE_ESPERADO = 16000;

async function arquivoExiste(caminho: string): Promise<boolean> {
  try {
    const res = await fetch(caminho, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export class OpenWakeWordEngine implements WakeWordEngine {
  private config: WakeWordConfig | null = null;
  private ort: typeof import("onnxruntime-web") | null = null;
  private sessaoMelspec: import("onnxruntime-web").InferenceSession | null = null;
  private sessaoEmbedding: import("onnxruntime-web").InferenceSession | null = null;
  private sessaoClassificador: import("onnxruntime-web").InferenceSession | null = null;

  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private streamAtual: MediaStream | null = null;
  private bufferDeEmbeddings: Float32Array[] = [];
  private ativo = false;
  private pausado = false;
  private ultimaDeteccaoMs = 0;

  private wakeWordListeners = new Set<(event: WakeWordEvent) => void>();
  private speechStartListeners = new Set<() => void>();
  private speechEndListeners = new Set<() => void>();

  async initialize(config: WakeWordConfig): Promise<void> {
    const [melspecOk, embeddingOk, vetorOk] = await Promise.all([
      arquivoExiste(`${BASE_PATH}/melspectrogram.onnx`),
      arquivoExiste(`${BASE_PATH}/embedding_model.onnx`),
      arquivoExiste(`${BASE_PATH}/vetor.onnx`),
    ]);

    if (!melspecOk || !embeddingOk || !vetorOk) {
      const faltando = [
        !melspecOk && "melspectrogram.onnx",
        !embeddingOk && "embedding_model.onnx",
        !vetorOk && "vetor.onnx (modelo custom da palavra 'vetor' — ver docs/voice/wake-word-training.md)",
      ].filter(Boolean);
      throw new WakeWordUnavailableError(
        "openwakeword-wasm",
        `Modelo(s) ausente(s) em /public/wake-word/: ${faltando.join(", ")}.`,
      );
    }

    // Import dinâmico — só baixa onnxruntime-web se este provider for de fato
    // selecionado (ver selectProvider.ts), nunca no bundle de quem não usa.
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1; // evita exigir headers COOP/COEP de cross-origin isolation
    this.ort = ort;

    try {
      const [melspec, embedding, classificador] = await Promise.all([
        ort.InferenceSession.create(`${BASE_PATH}/melspectrogram.onnx`),
        ort.InferenceSession.create(`${BASE_PATH}/embedding_model.onnx`),
        ort.InferenceSession.create(`${BASE_PATH}/vetor.onnx`),
      ]);
      this.sessaoMelspec = melspec;
      this.sessaoEmbedding = embedding;
      this.sessaoClassificador = classificador;
    } catch (err) {
      throw new WakeWordUnavailableError(
        "openwakeword-wasm",
        `Falha ao carregar sessão ONNX: ${err instanceof Error ? err.message : "erro desconhecido"}.`,
      );
    }

    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config || !this.sessaoClassificador) {
      throw new Error("OpenWakeWordEngine.start() chamado antes de initialize() concluir com sucesso.");
    }
    this.ativo = true;
    this.pausado = false;
    this.bufferDeEmbeddings = [];

    this.streamAtual = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: SAMPLE_RATE_ESPERADO },
    });

    const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE_ESPERADO });
    if (audioContext.sampleRate !== SAMPLE_RATE_ESPERADO) {
      audioContext.close();
      this.streamAtual.getTracks().forEach((t) => t.stop());
      throw new WakeWordUnavailableError(
        "openwakeword-wasm",
        `O navegador não permitiu abrir o microfone a ${SAMPLE_RATE_ESPERADO}Hz (abriu a ${audioContext.sampleRate}Hz) — ` +
          "sem reamostragem implementada nesta versão, a detecção ficaria incorreta silenciosamente, então preferimos falhar aqui.",
      );
    }

    await audioContext.audioWorklet.addModule(`${BASE_PATH}/pcm-processor.js`);
    const source = audioContext.createMediaStreamSource(this.streamAtual);
    const worklet = new AudioWorkletNode(audioContext, "vetor-pcm-processor");
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      void this.processarBloco(event.data);
    };
    source.connect(worklet);

    this.audioContext = audioContext;
    this.workletNode = worklet;
  }

  async pause(): Promise<void> {
    this.pausado = true;
    await this.encerrarCapturaDeAudio();
  }

  async stop(): Promise<void> {
    this.ativo = false;
    this.pausado = false;
    await this.encerrarCapturaDeAudio();
  }

  private async encerrarCapturaDeAudio(): Promise<void> {
    this.workletNode?.port.close();
    this.workletNode?.disconnect();
    this.workletNode = null;
    if (this.audioContext && this.audioContext.state !== "closed") await this.audioContext.close();
    this.audioContext = null;
    this.streamAtual?.getTracks().forEach((t) => t.stop());
    this.streamAtual = null;
    this.bufferDeEmbeddings = [];
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

  private async processarBloco(pcm: Float32Array): Promise<void> {
    if (!this.ativo || this.pausado || !this.ort || !this.sessaoMelspec || !this.sessaoEmbedding || !this.sessaoClassificador) {
      return;
    }
    if (pcm.length !== AMOSTRAS_POR_BLOCO) return;

    const ort = this.ort;
    try {
      const entradaAudio = new ort.Tensor("float32", pcm, [1, AMOSTRAS_POR_BLOCO]);
      const saidaMelspec = await this.sessaoMelspec.run({ [this.sessaoMelspec.inputNames[0]]: entradaAudio });
      const melspecTensor = saidaMelspec[this.sessaoMelspec.outputNames[0]];

      const saidaEmbedding = await this.sessaoEmbedding.run({ [this.sessaoEmbedding.inputNames[0]]: melspecTensor });
      const embeddingTensor = saidaEmbedding[this.sessaoEmbedding.outputNames[0]];

      this.bufferDeEmbeddings.push(Float32Array.from(embeddingTensor.data as Float32Array));
      if (this.bufferDeEmbeddings.length > FRAMES_EMPILHADOS_NO_EMBEDDING) {
        this.bufferDeEmbeddings.shift();
      }
      if (this.bufferDeEmbeddings.length < FRAMES_EMPILHADOS_NO_EMBEDDING) return; // ainda enchendo a janela de contexto

      const dimEmbedding = this.bufferDeEmbeddings[0].length;
      const janela = new Float32Array(FRAMES_EMPILHADOS_NO_EMBEDDING * dimEmbedding);
      this.bufferDeEmbeddings.forEach((frame, i) => janela.set(frame, i * dimEmbedding));

      const entradaClassificador = new ort.Tensor("float32", janela, [1, FRAMES_EMPILHADOS_NO_EMBEDDING, dimEmbedding]);
      const saidaClassificador = await this.sessaoClassificador.run({
        [this.sessaoClassificador.inputNames[0]]: entradaClassificador,
      });
      const probabilidade = (saidaClassificador[this.sessaoClassificador.outputNames[0]].data as Float32Array)[0];

      const limiar = this.config?.sensitivity ?? 0.5;
      if (probabilidade < limiar) return;

      const agora = Date.now();
      const cooldown = this.config?.cooldownMs ?? 2500;
      if (!passouCooldown(this.ultimaDeteccaoMs, agora, cooldown)) return;
      this.ultimaDeteccaoMs = agora;

      for (const cb of this.wakeWordListeners) cb({ keyword: "vetor", confidence: probabilidade, timestampMs: agora });
    } catch (err) {
      console.warn("[voice] Falha ao rodar inferência do wake word:", err instanceof Error ? err.message : err);
    }
  }
}

// TODO(voice/wake-word): assim que vetor.onnx existir de verdade (ver
// docs/voice/wake-word-training.md), validar contra áudio real:
// 1. Confirmar que FRAMES_EMPILHADOS_NO_EMBEDDING bate com o shape de
//    entrada esperado pelo classificador treinado (pode não ser 16 — depende
//    de como o notebook de treino foi configurado).
// 2. Confirmar taxa de falso positivo/negativo com gravações reais de
//    "vetor" em PT-BR e ajustar `sensitivity` default.
// 3. onSpeechStart/onSpeechEnd deste provider ainda não estão implementados
//    (não há um detector de atividade de voz separado do classificador de
//    wake word) — o VetorVoiceProvider não deve depender deles pra este
//    provider específico até isso ser resolvido.
