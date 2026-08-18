// Decide quando uma captura de solicitação de voz deve parar — puro, sem
// tocar em MediaRecorder/AudioContext, só recebe amostras de amplitude ao
// longo do tempo. Isso existe separado da captura de áudio de verdade só
// pra poder testar a lógica de silêncio/timeout sem mockar a Web Audio API.

export interface ConfigDetectorDeSilencio {
  // Amplitude (0..1) abaixo da qual consideramos "silêncio" nesta amostra.
  limiar: number;
  // Quanto tempo (ms) de silêncio contínuo encerra a captura.
  silenceTimeoutMs: number;
  // Teto absoluto (ms) de captura, mesmo falando sem parar.
  maxDurationMs: number;
}

export class DetectorDeSilencio {
  private inicioMs: number | null = null;
  private inicioDoSilencioMs: number | null = null;
  // Bug real observado em produção: sem essa flag, o silêncio ANTES da
  // pessoa começar a falar (reação natural ao bipe + latência de abrir o
  // microfone) já contava pro timeout — a captura parava sozinha antes de
  // qualquer fala de verdade ser gravada, e a OpenAI devolvia "sem texto".
  // Agora o timeout de silêncio só passa a valer depois da primeira amostra
  // acima do limiar (alguém falou pelo menos uma vez); antes disso, só o
  // teto absoluto (maxDurationMs) pode encerrar a captura.
  private falouAlgumaVez = false;

  constructor(private readonly config: ConfigDetectorDeSilencio) {}

  // Retorna true quando a captura deve parar agora.
  registrar(amplitude: number, timestampMs: number): boolean {
    if (this.inicioMs === null) this.inicioMs = timestampMs;

    if (timestampMs - this.inicioMs >= this.config.maxDurationMs) return true;

    if (amplitude < this.config.limiar) {
      if (!this.falouAlgumaVez) return false; // ainda esperando a pessoa começar a falar
      if (this.inicioDoSilencioMs === null) this.inicioDoSilencioMs = timestampMs;
      return timestampMs - this.inicioDoSilencioMs >= this.config.silenceTimeoutMs;
    }

    this.falouAlgumaVez = true;
    this.inicioDoSilencioMs = null; // voltou a falar — reseta a contagem de silêncio
    return false;
  }

  reiniciar(): void {
    this.inicioMs = null;
    this.inicioDoSilencioMs = null;
    this.falouAlgumaVez = false;
  }
}

// RMS normalizado (0..1) a partir de um buffer de amplitude de tempo (Uint8
// Array do AnalyserNode.getByteTimeDomainData, valores 0..255 centrados em
// 128) — pura, testável sem AudioContext real.
export function calcularAmplitudeRms(bufferTempo: Uint8Array): number {
  if (bufferTempo.length === 0) return 0;
  let somaDosQuadrados = 0;
  for (let i = 0; i < bufferTempo.length; i++) {
    const normalizado = (bufferTempo[i] - 128) / 128;
    somaDosQuadrados += normalizado * normalizado;
  }
  return Math.sqrt(somaDosQuadrados / bufferTempo.length);
}
