// Camada de seleção de provider — nunca hardcoded num componente. Tenta a
// ordem de preferência real (local de verdade primeiro, fallback por
// último), aceitando cada um só se initialize() realmente funcionar (nunca
// assume "deve funcionar" sem tentar). Ver docs/voice/wake-word-training.md
// pro estado de cada provider nesta rodada.

import { BrowserSpeechWakeWordEngine } from "./providers/browserSpeechEngine";
import { MockWakeWordEngine } from "./providers/mockEngine";
import { OpenWakeWordEngine } from "./providers/openWakeWordEngine";
import { PorcupineEngine } from "./providers/porcupineEngine";
import type { WakeWordConfig, WakeWordEngine, WakeWordProvider } from "./types";
import { WakeWordUnavailableError } from "./types";

// Ordem de preferência em produção: detecção local de verdade antes do
// fallback que depende de nuvem. Hoje só o último da lista tem um modelo
// utilizável (nenhum vetor.onnx/AccessKey configurados ainda) — mas a ordem
// já reflete a prioridade certa pro dia em que existirem.
const ORDEM_DE_PRODUCAO: WakeWordProvider[] = ["openwakeword-wasm", "porcupine-web", "browser-speech-fallback"];

function instanciar(provider: WakeWordProvider): WakeWordEngine {
  switch (provider) {
    case "openwakeword-wasm":
      return new OpenWakeWordEngine();
    case "porcupine-web":
      return new PorcupineEngine();
    case "browser-speech-fallback":
      return new BrowserSpeechWakeWordEngine();
    case "mock":
      return new MockWakeWordEngine();
  }
}

export interface ResultadoSelecao {
  engine: WakeWordEngine;
  provider: WakeWordProvider;
}

export interface FalhaDeProvider {
  provider: WakeWordProvider;
  motivo: string;
}

export class NenhumProviderDisponivelError extends Error {
  constructor(public readonly falhas: FalhaDeProvider[]) {
    super(`Nenhum provider de wake word ficou disponível: ${falhas.map((f) => `${f.provider} (${f.motivo})`).join("; ")}`);
    this.name = "NenhumProviderDisponivelError";
  }
}

// forcarProvider: usado em testes (sempre "mock") e em ferramentas de
// desenvolvimento (override manual via variável de ambiente/flag local) —
// nunca em produção real sem essa intenção explícita.
export async function selecionarWakeWordEngine(
  config: WakeWordConfig,
  opcoes: { forcarProvider?: WakeWordProvider } = {},
): Promise<ResultadoSelecao> {
  if (opcoes.forcarProvider) {
    const engine = instanciar(opcoes.forcarProvider);
    await engine.initialize(config);
    return { engine, provider: opcoes.forcarProvider };
  }

  const falhas: FalhaDeProvider[] = [];
  for (const provider of ORDEM_DE_PRODUCAO) {
    const engine = instanciar(provider);
    try {
      await engine.initialize(config);
      return { engine, provider };
    } catch (err) {
      // Só "indisponível por design" (sem modelo, sem SDK, sem suporte do
      // navegador) vira uma falha agregada e segue pro próximo provider —
      // qualquer outro erro é um bug de verdade (ex: initialize() quebrou
      // por um motivo que não deveria acontecer) e precisa propagar, nunca
      // ser mascarado como "esse provider só não está pronto ainda".
      if (!(err instanceof WakeWordUnavailableError)) throw err;
      falhas.push({ provider, motivo: err.message });
      console.warn(`[voice] provider "${provider}" indisponível, tentando o próximo:`, err.message);
    }
  }

  throw new NenhumProviderDisponivelError(falhas);
}
