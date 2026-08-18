// Provider "porcupine-web" — STUB. O SDK (@picovoice/porcupine-web,
// Apache-2.0) NÃO está instalado nesta rodada porque a decisão do produto
// foi investir no modelo próprio via openWakeWord (custo zero de licença
// pra sempre) em vez de Porcupine. IMPORTANTE (confirmado em pesquisa ao
// vivo, ago/2026): a Picovoice ENCERROU o tier gratuito em 30/06/2026 e
// passou a atender só clientes enterprise — não existe mais o limite de "3
// usuários ativos/mês" grátis. Planos pagos partem de ~US$ 899/mês (plano
// "Foundation" citado em ~US$ 6.000). Ativar este provider hoje exigiria
// contrato comercial direto com a Picovoice antes de qualquer código. Este
// arquivo existe só pra deixar o caminho documentado caso essa decisão de
// custo seja aprovada pelo negócio no futuro.
//
// Pra ativar de verdade:
//   1. npm install @picovoice/porcupine-web @picovoice/web-voice-processor
//   2. Negociar um plano comercial em https://console.picovoice.ai/ e obter
//      uma AccessKey (não há mais tier gratuito de produção)
//   3. Treinar a palavra-chave "vetor" no Picovoice Console (self-serve,
//      português já suportado) e baixar o arquivo .ppn
//   4. Guardar a AccessKey no servidor (nunca no bundle do navegador — o
//      Console permite gerar uma chave restrita por domínio, que é o único
//      formato aceitável de expor no cliente)
//   5. Implementar initialize()/start() de verdade usando
//      PorcupineWorkerFactory.create(accessKey, [keyword], callback) da SDK
//
// Até isso acontecer, initialize() sempre falha com WakeWordUnavailableError
// — nunca finge que a detecção está disponível.

import type { WakeWordEngine } from "../types";
import { WakeWordUnavailableError } from "../types";

export class PorcupineEngine implements WakeWordEngine {
  async initialize(): Promise<void> {
    throw new WakeWordUnavailableError(
      "porcupine-web",
      "SDK não instalada e AccessKey não configurada nesta rodada — ver comentário no topo de porcupineEngine.ts pro caminho de ativação.",
    );
  }

  async start(): Promise<void> {
    throw new WakeWordUnavailableError("porcupine-web", "initialize() nunca foi concluído com sucesso.");
  }

  async pause(): Promise<void> {}

  async stop(): Promise<void> {}

  onWakeWord(): () => void {
    return () => {};
  }

  onSpeechStart(): () => void {
    return () => {};
  }

  onSpeechEnd(): () => void {
    return () => {};
  }
}
