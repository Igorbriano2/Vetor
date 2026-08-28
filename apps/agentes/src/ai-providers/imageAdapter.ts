import { randomUUID } from "node:crypto";
import { supabase } from "../db/supabase.js";
import { gerarImagem, gerarImagemComReferencia, type ReferenciaImagem } from "../integrations/imageProvider.js";
import type { AIModel, AIProviderAdapter, GenerationJobResult, GenerationRequest } from "./types.js";

// Adapter real de imagem pra suíte "estúdio direto" — reaproveita o MESMO
// gateway (OpenAI/Gemini com fallback automático) que o agente de Design já
// usa via criar_peca_de_design (ver apps/agentes/src/integrations/
// imageProvider.ts), só que sem passar pela missão/aprovação: aqui o
// cliente clica gerar e vê o resultado na hora, igual ao "Image Generator"
// do Magnific e ao node de Resultado do Gravyx — nenhuma lógica de geração
// nova, só um caminho direto até o gateway que já existia.
export const MODELO_IMAGEM_PADRAO: AIModel = {
  id: "imagem-real-padrao",
  providerId: "vetor-imagem",
  providerModelId: "auto",
  kind: "image",
  label: "Geração real (OpenAI / Gemini)",
  description: "Gera a peça de verdade — mesmo gateway usado pelo agente de Design, sem passar por aprovação de missão.",
  capabilities: { referenceImages: true, multiReference: true, negativePrompt: false, maxResolution: "2K" },
  costCredits: 4,
  avgLatencyMs: 12000,
  status: "featured",
};

const BUCKET = "artifacts";
// Mesmo raciocínio do FishAudioAdapter: generation_jobs.result_asset_urls
// nunca é recomputado depois de "done" (ver aiSuite.ts), então a URL
// guardada precisa se sustentar sozinha — signed URL de validade longa em
// vez de reassinar a cada leitura.
const VALIDADE_SIGNED_URL_SEGUNDOS = 60 * 60 * 24 * 365 * 5;
const PREFIXO_JOB = "vetor-imagem";
const MAX_QUANTIDADE = 6;

async function resolverReferencias(assetIds: string[] | undefined): Promise<ReferenciaImagem[]> {
  if (!assetIds?.length) return [];
  const { data: assets } = await supabase.from("business_assets").select("id, nome, storage_path").in("id", assetIds);
  if (!assets?.length) return [];

  const referencias: ReferenciaImagem[] = [];
  for (const asset of assets) {
    const { data: baixado } = await supabase.storage.from("brand-assets").download(asset.storage_path as string);
    if (!baixado) continue;
    referencias.push({
      bytes: Buffer.from(await baixado.arrayBuffer()),
      mimeType: baixado.type || "image/png",
      nome: asset.nome as string,
    });
  }
  return referencias;
}

async function gerarUmaImagem(prompt: string, referencias: ReferenciaImagem[], aspectRatio: string | undefined, provider: string | undefined): Promise<string> {
  const imagem =
    referencias.length > 0 ? await gerarImagemComReferencia(prompt, referencias, { aspectRatio, provider }) : await gerarImagem(prompt, { aspectRatio, provider });

  const extensao = imagem.mimeType === "image/jpeg" ? "jpg" : "png";
  const path = `ai-suite/image/${randomUUID()}.${extensao}`;
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(path, imagem.bytes, { contentType: imagem.mimeType, upsert: false });
  if (erroUpload) throw new Error(`Falha ao guardar a imagem gerada: ${erroUpload.message}`);

  const { data: assinado, error: erroAssinatura } = await supabase.storage.from(BUCKET).createSignedUrl(path, VALIDADE_SIGNED_URL_SEGUNDOS);
  if (erroAssinatura || !assinado?.signedUrl) throw new Error(`Falha ao gerar link da imagem: ${erroAssinatura?.message ?? "sem URL"}`);
  return assinado.signedUrl;
}

// Mesmo princípio "stateless" do FishAudioAdapter/MockAdapter — a geração
// já aconteceu de verdade dentro de generate(), o jobId só carrega as URLs
// finais (uma por variação pedida), getJobStatus só decodifica.
function montarJobId(urls: string[]): string {
  return `${PREFIXO_JOB}:${Buffer.from(JSON.stringify(urls), "utf8").toString("base64url")}`;
}

function parseJobId(jobId: string): string[] | null {
  const separador = jobId.indexOf(":");
  if (separador === -1 || jobId.slice(0, separador) !== PREFIXO_JOB) return null;
  try {
    const urls = JSON.parse(Buffer.from(jobId.slice(separador + 1), "base64url").toString("utf8"));
    return Array.isArray(urls) ? urls : null;
  } catch {
    return null;
  }
}

export class ImageAdapter implements AIProviderAdapter {
  providerId = "vetor-imagem";

  async listModels(): Promise<AIModel[]> {
    return [MODELO_IMAGEM_PADRAO];
  }

  // Síncrono de propósito (mesmo padrão do FishAudioAdapter): gera e sobe
  // TODAS as variações pedidas aqui dentro, generate() só retorna depois de
  // ter asset(s) real(is) gravado(s) — nunca finge sucesso antes de existir.
  async generate(request: GenerationRequest, _model: AIModel): Promise<{ jobId: string }> {
    const prompt = request.prompt?.trim();
    if (!prompt) throw new Error("Descreva o que a imagem deve mostrar antes de gerar.");

    const referencias = await resolverReferencias(request.referenceAssetIds);
    const quantidade = Math.max(1, Math.min(MAX_QUANTIDADE, request.quantity ?? 1));
    const provider = typeof request.extra?.provider === "string" ? request.extra.provider : undefined;

    const urls: string[] = [];
    for (let i = 0; i < quantidade; i += 1) {
      urls.push(await gerarUmaImagem(prompt, referencias, request.aspectRatio, provider));
    }

    return { jobId: montarJobId(urls) };
  }

  async getJobStatus(jobId: string): Promise<GenerationJobResult> {
    const urls = parseJobId(jobId);
    if (!urls) return { status: "failed", error: `jobId inválido pro ImageAdapter: "${jobId}"` };
    return { status: "done", resultAssetUrls: urls };
  }
}
