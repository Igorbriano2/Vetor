// Transcrição de voz (speech-to-text) para o Agente Secretário entender áudios do
// WhatsApp. Plugável por variável de ambiente — nenhum provedor específico é uma
// decisão técnica fechada, ver docs/07. Sem STT_PROVIDER configurado, roda em modo
// sandbox e devolve um aviso em vez de travar o atendimento.

function isSandbox() {
  return (process.env.STT_PROVIDER ?? "sandbox") === "sandbox";
}

export class TranscricaoIndisponivelError extends Error {}

export async function transcreverAudio(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  if (isSandbox()) {
    console.log(`[transcricao:sandbox] recebido áudio de ${bytes.byteLength} bytes (${mimeType})`);
    throw new TranscricaoIndisponivelError(
      "STT_PROVIDER não configurado — transcrição de áudio ainda não está ativa neste ambiente.",
    );
  }

  const provider = process.env.STT_PROVIDER;

  if (provider === "openai") {
    return transcreverComOpenAI(bytes, mimeType);
  }

  throw new TranscricaoIndisponivelError(`STT_PROVIDER "${provider}" não suportado`);
}

async function transcreverComOpenAI(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TranscricaoIndisponivelError("OPENAI_API_KEY é obrigatório quando STT_PROVIDER=openai");
  }

  const extensao = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "bin";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), `audio.${extensao}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha na transcrição via OpenAI (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { text?: string };
  if (!data.text) {
    throw new Error("Transcrição da OpenAI voltou sem texto");
  }
  return data.text;
}
