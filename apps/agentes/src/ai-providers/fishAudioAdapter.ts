import { randomUUID } from "node:crypto";
import { supabase } from "../db/supabase.js";
import { chamarFishAudioTTS } from "../integrations/fishAudioClient.js";
import type { AIModel, AIProviderAdapter, GenerationJobResult, GenerationRequest } from "./types.js";

// Adapter real de voz — Fish Audio TTS (https://api.fish.audio/v1/tts).
// Único provider real desta suíte além do Claude de melhorar-prompt (ver
// docs/arquitetura-suite-ia.md seção 4 — nenhuma chave de imagem/vídeo/3D
// configurada ainda). Chave lida só de env, nunca commitada.
export const MODELO_FISHAUDIO_PADRAO: AIModel = {
  id: "fishaudio-voz-padrao",
  providerId: "fishaudio",
  providerModelId: "s2.1-pro",
  kind: "voice",
  label: "Voz natural (Fish Audio)",
  description: "Locução realista em português — provider real, não é pré-visualização.",
  capabilities: { audio: true },
  costCredits: 3,
  avgLatencyMs: 6000,
  status: "featured",
};

const BUCKET = "artifacts";
// Signed URL de validade longa (5 anos) em vez de re-assinar a cada
// leitura: generation_jobs.result_asset_urls é escrito uma vez e nunca
// mais recomputado pela rota /jobs/:id/status depois de "done" (ver
// aiSuite.ts), então a URL guardada precisa continuar válida sozinha —
// mesmo princípio de "nunca deixar o cliente com um link quebrado depois".
const VALIDADE_SIGNED_URL_SEGUNDOS = 60 * 60 * 24 * 365 * 5;

// Mesma variável usada pela voz de resposta do agente no WhatsApp (ver
// src/integrations/tts.ts) — uma chave real da Fish Audio serve os dois
// usos, nunca duplicar o segredo em 2 nomes de env diferentes.
function chave(): string {
  const k = process.env.FISH_AUDIO_API_KEY;
  if (!k) throw new Error("FISH_AUDIO_API_KEY não configurada.");
  return k;
}

async function resolverReferenceId(voiceIds: unknown): Promise<string | undefined> {
  if (!Array.isArray(voiceIds) || voiceIds.length === 0) return undefined;
  const primeiro = voiceIds.find((v) => typeof v === "string");
  if (!primeiro) return undefined;
  // Só usa a 1ª voz selecionada — a API do Fish Audio não documenta mistura
  // de múltiplas reference_id numa síntese só, então não arriscamos supor
  // um comportamento não confirmado.
  const { data } = await supabase.from("voices").select("provider_voice_id").eq("id", primeiro).eq("provider_id", "fishaudio").maybeSingle();
  const providerVoiceId = data?.provider_voice_id as string | undefined;
  // "__default__" (ver migração 0042) marca a voz padrão do catálogo, que
  // não tem reference_id próprio ainda — nunca manda esse literal pro
  // provider como se fosse um id de voz clonada real.
  if (!providerVoiceId || providerVoiceId === "__default__") return undefined;
  return providerVoiceId;
}

// Estado carregado no próprio jobId (mesmo princípio "stateless" do
// MockAdapter — sem Map em memória, sobrevive a restart/múltiplas
// instâncias): a síntese já aconteceu de verdade dentro de generate(), o
// jobId só carrega a URL final assinada, getJobStatus só decodifica.
const PREFIXO_JOB = "fishaudio";

function montarJobId(url: string): string {
  return `${PREFIXO_JOB}:${Buffer.from(url, "utf8").toString("base64url")}`;
}

function parseJobId(jobId: string): string | null {
  const separador = jobId.indexOf(":");
  if (separador === -1 || jobId.slice(0, separador) !== PREFIXO_JOB) return null;
  try {
    return Buffer.from(jobId.slice(separador + 1), "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export class FishAudioAdapter implements AIProviderAdapter {
  providerId = "fishaudio";

  async listModels(): Promise<AIModel[]> {
    return [MODELO_FISHAUDIO_PADRAO];
  }

  // Síncrono de propósito: a API do Fish Audio devolve o áudio pronto no
  // corpo da resposta (sem fila/job do lado deles), então a síntese +
  // upload acontecem aqui dentro mesmo, e generate() só retorna depois de
  // ter um asset real gravado — nunca finge sucesso antes de existir.
  async generate(request: GenerationRequest, _model: AIModel): Promise<{ jobId: string }> {
    const texto = request.prompt?.trim();
    if (!texto) throw new Error("Roteiro vazio — nada pra sintetizar.");

    const referenceId = await resolverReferenceId(request.extra?.voiceIds);

    const audio = await chamarFishAudioTTS({
      apiKey: chave(),
      texto,
      referenceId,
      format: "mp3",
      mp3Bitrate: 128,
    });

    const bytes = Buffer.from(audio.bytes);
    const path = `ai-suite/voice/${randomUUID()}.mp3`;

    const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: false });
    if (erroUpload) throw new Error(`Falha ao guardar o áudio gerado: ${erroUpload.message}`);

    const { data: assinado, error: erroAssinatura } = await supabase.storage.from(BUCKET).createSignedUrl(path, VALIDADE_SIGNED_URL_SEGUNDOS);
    if (erroAssinatura || !assinado?.signedUrl) throw new Error(`Falha ao gerar link do áudio: ${erroAssinatura?.message ?? "sem URL"}`);

    return { jobId: montarJobId(assinado.signedUrl) };
  }

  // Sempre "done" — o trabalho de verdade já aconteceu em generate(); não
  // há status intermediário real pra reportar do lado do Fish Audio.
  async getJobStatus(jobId: string): Promise<GenerationJobResult> {
    const url = parseJobId(jobId);
    if (!url) return { status: "failed", error: `jobId inválido pro FishAudioAdapter: "${jobId}"` };
    return { status: "done", resultAssetUrls: [url] };
  }
}
