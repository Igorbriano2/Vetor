// AudioWorklet processor pro provider "openwakeword-wasm" — só encaminha o
// PCM cru (Float32, mono) pra thread principal em blocos fixos, nenhum
// processamento de ML acontece aqui (isso fica no ONNX Runtime Web, na
// thread principal/openWakeWordEngine.ts). Carregado via
// audioContext.audioWorklet.addModule("/wake-word/pcm-processor.js").
//
// Servido como arquivo estático — nunca passa pelo bundler do Next.js
// (AudioWorkletGlobalScope não entende import/export de módulos ES do jeito
// que o Turbopack empacota).

const TAMANHO_DO_BLOCO = 1280; // 80ms a 16kHz — janela padrão do openWakeWord

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(TAMANHO_DO_BLOCO);
    this.offset = 0;
  }

  process(inputs) {
    const canal = inputs[0]?.[0];
    if (!canal) return true;

    for (let i = 0; i < canal.length; i++) {
      this.buffer[this.offset] = canal[i];
      this.offset++;
      if (this.offset === TAMANHO_DO_BLOCO) {
        this.port.postMessage(this.buffer.slice(0));
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("vetor-pcm-processor", PcmProcessor);
