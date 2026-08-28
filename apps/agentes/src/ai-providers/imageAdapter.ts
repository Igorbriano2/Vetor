import { randomUUID } from "node:crypto";
import { supabase } from "../db/supabase.js";
import { gerarPecaCompostaReal } from "../negocio/pecaCompostaReal.js";
import type { AIModel, AIProviderAdapter, GenerationJobResult, GenerationRequest } from "./types.js";

// Adapter real de imagem pra suíte "estúdio direto" — reaproveita o MESMO
// pipeline de composição (fundo gerado sem texto + BrandKit real + logo/
// Drive como camadas próprias + texto real via sharp/Pango) que o agente de
// Design usa via criar_peca_de_design, ver negocio/pecaCompostaReal.ts. Sem
// missão/aprovação: o cliente clica gerar e vê o resultado na hora.
//
// Achado ao vivo (1ª rodada desta suíte): pedir pro MODELO DE IMAGEM
// desenhar o texto direto nos pixels saía com tipografia "crua" — os
// modelos de imagem não são bons nisso. Trocado por composição real desde
// então; nunca mais texto alucinado pela IA de imagem nesta suíte.
export const MODELO_IMAGEM_PADRAO: AIModel = {
  id: "imagem-real-padrao",
  providerId: "vetor-imagem",
  providerModelId: "auto",
  kind: "image",
  label: "Geração real (OpenAI / Gemini)",
  description: "Gera a peça de verdade — fundo + BrandKit + texto real compostos, mesmo pipeline do agente de Design.",
  capabilities: { referenceImages: true, multiReference: true, negativePrompt: false, maxResolution: "2K" },
  costCredits: 4,
  avgLatencyMs: 14000,
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

async function gerarUmaImagem(request: GenerationRequest, prompt: string): Promise<string> {
  const provider = typeof request.extra?.provider === "string" ? request.extra.provider : undefined;
  const peca = await gerarPecaCompostaReal({
    clienteId: request.clienteId!,
    promptLivre: prompt,
    aspectRatio: request.aspectRatio,
    assetIds: request.referenceAssetIds,
    provider,
  });

  const path = `ai-suite/image/${randomUUID()}.png`;
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(path, peca.bytes, { contentType: peca.mimeType, upsert: false });
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
    if (!request.clienteId) throw new Error("clienteId é obrigatório pra gerar uma peça real (BrandKit/logo/Drive).");

    const quantidade = Math.max(1, Math.min(MAX_QUANTIDADE, request.quantity ?? 1));

    const urls: string[] = [];
    for (let i = 0; i < quantidade; i += 1) {
      urls.push(await gerarUmaImagem(request, prompt));
    }

    return { jobId: montarJobId(urls) };
  }

  async getJobStatus(jobId: string): Promise<GenerationJobResult> {
    const urls = parseJobId(jobId);
    if (!urls) return { status: "failed", error: `jobId inválido pro ImageAdapter: "${jobId}"` };
    return { status: "done", resultAssetUrls: urls };
  }
}
