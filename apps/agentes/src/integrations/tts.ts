// Texto-para-voz (TTS) para o agente Vetor responder em áudio quando o cliente
// pergunta por áudio no WhatsApp — ver docs/07, seção 4. Plugável por variável de
// ambiente, mesmo padrão de src/integrations/transcricao.ts (STT). Sem
// TTS_PROVIDER configurado, roda em modo sandbox e força o chamador a cair para
// texto em vez de travar o atendimento.
//
// Roteado via ProviderRouter (Parte 6, ver providers/router.ts): quando o
// provedor preferido é "fish" (voz clonada própria do cliente), a OpenAI
// entra como FALLBACK real — se a Fish Audio estiver fora do ar ou a conta
// mal configurada, a resposta em voz degrada pra uma voz genérica em vez de
// quebrar o atendimento inteiro. Nunca o contrário (openai como preferido
// não cai pra fish): usar a voz clonada de um cliente como fallback de
// outro tenant seria um vazamento de identidade de marca, não uma
// degradação aceitável.

import { executarComFallback, TodosOsProvedoresFalharamError, type ProvedorRegistrado } from "../providers/router.js";
import { chamarFishAudioTTS } from "./fishAudioClient.js";

function isSandbox() {
  return (process.env.TTS_PROVIDER ?? "sandbox") === "sandbox";
}

export class SinteseVozIndisponivelError extends Error {}

export interface AudioSintetizado {
  bytes: ArrayBuffer;
  mimeType: string;
}

async function sintetizarComOpenAI(texto: string): Promise<AudioSintetizado> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY é obrigatório pra usar a OpenAI como provedor de TTS");
  }

  const voz = process.env.TTS_VOICE ?? "onyx";

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: voz,
      input: texto,
      response_format: "opus",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha na síntese de voz via OpenAI (${res.status}): ${body}`);
  }

  return {
    bytes: await res.arrayBuffer(),
    mimeType: "audio/ogg",
  };
}

// Fish Audio — modelo de voz próprio do cliente (reference_id), pra dar uma
// voz consistente ao Vetor em vez de uma voz genérica de provedor. Ver
// https://fish.audio/pt/blog/s2-1-pro-free-api/ — a única diferença de outras
// chamadas Fish Audio é o header "model" fixando o tier gratuito.
async function sintetizarComFishAudio(texto: string): Promise<AudioSintetizado> {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) {
    throw new Error("FISH_AUDIO_API_KEY é obrigatório pra usar a Fish Audio como provedor de TTS");
  }

  const referenceId = process.env.FISH_AUDIO_VOICE_ID;
  if (!referenceId) {
    throw new Error("FISH_AUDIO_VOICE_ID é obrigatório pra usar a Fish Audio como provedor de TTS");
  }

  const modelo = process.env.FISH_AUDIO_MODEL ?? "s2.1-pro-free";

  return chamarFishAudioTTS({ apiKey, texto, referenceId, modelo, format: "opus" });
}

const PROVEDOR_OPENAI: ProvedorRegistrado<string, AudioSintetizado> = {
  nome: "openai",
  disponivel: () => !!process.env.OPENAI_API_KEY,
  executar: sintetizarComOpenAI,
};

const PROVEDOR_FISH: ProvedorRegistrado<string, AudioSintetizado> = {
  nome: "fish",
  disponivel: () => !!process.env.FISH_AUDIO_API_KEY && !!process.env.FISH_AUDIO_VOICE_ID,
  executar: sintetizarComFishAudio,
};

// Monta a cadeia de fallback a partir do TTS_PROVIDER preferido — pura
// (nenhuma chamada de rede), só decide a ORDEM. Ver comentário no topo do
// arquivo sobre por que o fallback é assimétrico (fish->openai, nunca o
// contrário).
export function montarCadeiaDeProvedores(providerPreferido: string | undefined): ProvedorRegistrado<string, AudioSintetizado>[] {
  if (providerPreferido === "fish") return [PROVEDOR_FISH, PROVEDOR_OPENAI];
  if (providerPreferido === "openai") return [PROVEDOR_OPENAI];
  return [];
}

export async function sintetizarFala(texto: string): Promise<AudioSintetizado> {
  if (isSandbox()) {
    console.log(`[tts:sandbox] sintetizaria ${texto.length} caracteres de fala`);
    throw new SinteseVozIndisponivelError(
      "TTS_PROVIDER não configurado — resposta em voz ainda não está ativa neste ambiente.",
    );
  }

  const provider = process.env.TTS_PROVIDER;
  const cadeia = montarCadeiaDeProvedores(provider);
  if (cadeia.length === 0) {
    throw new SinteseVozIndisponivelError(`TTS_PROVIDER "${provider}" não suportado`);
  }

  try {
    const { resultado, provedorUsado, tentativas } = await executarComFallback(cadeia, texto);
    if (provedorUsado !== provider) {
      console.warn(`[tts] fallback: provedor preferido "${provider}" indisponível/falhou, usado "${provedorUsado}" em vez dele. Tentativas: ${JSON.stringify(tentativas)}`);
    }
    return resultado;
  } catch (err) {
    if (err instanceof TodosOsProvedoresFalharamError) {
      throw new SinteseVozIndisponivelError(err.message);
    }
    throw err;
  }
}
