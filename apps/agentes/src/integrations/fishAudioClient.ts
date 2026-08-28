// Chamada crua à API da Fish Audio (https://api.fish.audio/v1/tts) —
// extraído aqui porque dois lugares diferentes do produto chamam o mesmo
// endpoint com necessidades distintas: a voz do próprio agente Vetor
// (src/integrations/tts.ts, resposta em áudio no WhatsApp, 1 voz fixa por
// env var) e o Gerador de Voz da suíte de IA (src/ai-providers/
// fishAudioAdapter.ts, voz escolhida pelo cliente por geração). Este
// módulo só sabe fazer a chamada HTTP — quem chama decide formato/voz/
// onde guardar o resultado.

const TIMEOUT_PADRAO_MS = 60_000;

export interface ParametrosFishAudioTTS {
  apiKey: string;
  texto: string;
  referenceId?: string;
  modelo?: string; // header "model": s2.1-pro-free | s2.1-pro | s2-pro | s1
  format?: "mp3" | "wav" | "pcm" | "opus";
  mp3Bitrate?: 64 | 128 | 192;
  timeoutMs?: number;
}

export interface AudioFishAudio {
  bytes: ArrayBuffer;
  mimeType: string;
}

const MIME_POR_FORMATO: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pcm: "audio/pcm",
  opus: "audio/ogg",
};

export async function chamarFishAudioTTS(params: ParametrosFishAudioTTS): Promise<AudioFishAudio> {
  const format = params.format ?? "mp3";

  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      ...(params.modelo ? { model: params.modelo } : {}),
    },
    body: JSON.stringify({
      text: params.texto,
      ...(params.referenceId ? { reference_id: params.referenceId } : {}),
      format,
      ...(format === "mp3" && params.mp3Bitrate ? { mp3_bitrate: params.mp3Bitrate } : {}),
      normalize: true,
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? TIMEOUT_PADRAO_MS),
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Falha na síntese de voz via Fish Audio (${res.status}): ${corpo.slice(0, 300) || "sem detalhe"}`);
  }

  return { bytes: await res.arrayBuffer(), mimeType: MIME_POR_FORMATO[format]! };
}
