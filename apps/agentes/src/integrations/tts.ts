// Texto-para-voz (TTS) para o agente Vetor responder em áudio quando o cliente
// pergunta por áudio no WhatsApp — ver docs/07, seção 4. Plugável por variável de
// ambiente, mesmo padrão de src/integrations/transcricao.ts (STT). Sem
// TTS_PROVIDER configurado, roda em modo sandbox e força o chamador a cair para
// texto em vez de travar o atendimento.

function isSandbox() {
  return (process.env.TTS_PROVIDER ?? "sandbox") === "sandbox";
}

export class SinteseVozIndisponivelError extends Error {}

export interface AudioSintetizado {
  bytes: ArrayBuffer;
  mimeType: string;
}

export async function sintetizarFala(texto: string): Promise<AudioSintetizado> {
  if (isSandbox()) {
    console.log(`[tts:sandbox] sintetizaria ${texto.length} caracteres de fala`);
    throw new SinteseVozIndisponivelError(
      "TTS_PROVIDER não configurado — resposta em voz ainda não está ativa neste ambiente.",
    );
  }

  const provider = process.env.TTS_PROVIDER;

  if (provider === "openai") {
    return sintetizarComOpenAI(texto);
  }

  throw new SinteseVozIndisponivelError(`TTS_PROVIDER "${provider}" não suportado`);
}

async function sintetizarComOpenAI(texto: string): Promise<AudioSintetizado> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new SinteseVozIndisponivelError("OPENAI_API_KEY é obrigatório quando TTS_PROVIDER=openai");
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
