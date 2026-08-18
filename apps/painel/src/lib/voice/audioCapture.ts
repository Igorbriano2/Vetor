// Captura de verdade da solicitação de voz (pós-wake-word) — MediaRecorder +
// AnalyserNode pra amplitude em tempo real (alimenta o núcleo visual) e
// DetectorDeSilencio (silenceDetector.ts, puro) pra decidir quando parar.
// Só é chamado pelo VetorVoiceProvider DEPOIS de "vetor" ser detectado —
// nunca grava nada antes disso.

import { calcularAmplitudeRms, DetectorDeSilencio } from "./silenceDetector";

export interface OpcoesCaptura {
  silenceTimeoutMs?: number;
  maxDurationMs?: number;
  onAmplitude?: (amplitude: number) => void;
}

export interface ResultadoCaptura {
  blob: Blob;
  mimeType: string;
}

const LIMIAR_DE_SILENCIO = 0.02;
const SILENCE_TIMEOUT_PADRAO_MS = 1500;
const MAX_DURATION_PADRAO_MS = 15000;

// Toca um beep curto e sintético (osciloscópio, não um arquivo de áudio) ao
// detectar "vetor" — confirmação sonora imediata pedida na spec, sem
// depender de um asset extra.
export function tocarBipDeConfirmacao(): void {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
    oscillator.onended = () => ctx.close();
  } catch {
    // Web Audio indisponível não pode travar o fluxo de voz — só sem beep.
  }
}

// Captura a solicitação do usuário até silêncio ou o teto de duração.
// cancelador() interrompe a captura fora do ciclo normal (ex: usuário
// desligou a voz no meio da fala).
export function capturarSolicitacaoDeVoz(
  stream: MediaStream,
  opcoes: OpcoesCaptura = {},
): { resultado: Promise<ResultadoCaptura>; cancelar: () => void } {
  const detector = new DetectorDeSilencio({
    limiar: LIMIAR_DE_SILENCIO,
    silenceTimeoutMs: opcoes.silenceTimeoutMs ?? SILENCE_TIMEOUT_PADRAO_MS,
    maxDurationMs: opcoes.maxDurationMs ?? MAX_DURATION_PADRAO_MS,
  });

  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const bufferTempo = new Uint8Array(analyser.fftSize);

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let frameId: number;
  let cancelado = false;

  const resultado = new Promise<ResultadoCaptura>((resolve) => {
    recorder.onstop = () => {
      cancelAnimationFrame(frameId);
      audioContext.close();
      resolve({ blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), mimeType: recorder.mimeType || "audio/webm" });
    };

    function tick() {
      if (cancelado) return;
      analyser.getByteTimeDomainData(bufferTempo);
      const amplitude = calcularAmplitudeRms(bufferTempo);
      opcoes.onAmplitude?.(amplitude);
      if (detector.registrar(amplitude, performance.now())) {
        recorder.stop();
        return;
      }
      frameId = requestAnimationFrame(tick);
    }

    recorder.start();
    frameId = requestAnimationFrame(tick);
  });

  return {
    resultado,
    cancelar: () => {
      cancelado = true;
      cancelAnimationFrame(frameId);
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}
