import type { AIModel, AIProviderAdapter, GenerationJobResult, GenerationRequest } from "./types.js";

// Catálogo do provider "mock" — usado em desenvolvimento/demo enquanto
// nenhuma chave real (fal.ai/Replicate/FishAudio) está configurada (ver
// docs/arquitetura-suite-ia.md, seção 4). Sempre 1 modelo "featured"
// (barato/rápido) + 1 "available" (qualidade) por kind — suficiente pro
// AutoRouter ter uma escolha de verdade sem inflar o catálogo à toa.
export const MODELOS_MOCK: AIModel[] = [
  {
    id: "mock-image-rapido",
    providerId: "mock",
    providerModelId: "mock-image-fast",
    kind: "image",
    label: "Rápido e barato",
    description: "Geração de imagem rápida — bom pra rascunho e teste de composição.",
    capabilities: { referenceImages: true, multiReference: true, negativePrompt: true, maxResolution: "2K" },
    costCredits: 2,
    avgLatencyMs: 4000,
    status: "featured",
  },
  {
    id: "mock-image-qualidade",
    providerId: "mock",
    providerModelId: "mock-image-quality",
    kind: "image",
    label: "Melhor qualidade",
    description: "Mais detalhe e fidelidade — mais lento e mais caro.",
    capabilities: { referenceImages: true, multiReference: true, negativePrompt: true, maxResolution: "4K" },
    costCredits: 6,
    avgLatencyMs: 12000,
    status: "available",
  },
  {
    id: "mock-video-rapido",
    providerId: "mock",
    providerModelId: "mock-video-fast",
    kind: "video",
    label: "Rápido e barato",
    description: "Vídeo curto gerado rápido — bom pra testar uma ideia.",
    capabilities: { referenceImages: true, startEndFrame: true, maxResolution: "1080p", durationRangeSeconds: [2, 8] },
    costCredits: 10,
    avgLatencyMs: 15000,
    status: "featured",
  },
  {
    id: "mock-video-qualidade",
    providerId: "mock",
    providerModelId: "mock-video-quality",
    kind: "video",
    label: "Melhor qualidade",
    description: "Mais fluido e nítido, com áudio — mais lento.",
    capabilities: { referenceImages: true, startEndFrame: true, audio: true, lipSync: true, maxResolution: "2K", durationRangeSeconds: [2, 15] },
    costCredits: 25,
    avgLatencyMs: 40000,
    status: "available",
  },
  {
    id: "mock-voice-padrao",
    providerId: "mock",
    providerModelId: "mock-voice-standard",
    kind: "voice",
    label: "Voz natural",
    description: "Voz realista em português, boa pra locução e depoimento.",
    capabilities: { audio: true },
    costCredits: 3,
    avgLatencyMs: 3000,
    status: "featured",
  },
  {
    id: "mock-3d-padrao",
    providerId: "mock",
    providerModelId: "mock-3d-standard",
    kind: "3d",
    label: "Reconstrução padrão",
    description: "Tour 3D a partir de fotos do ambiente — qualidade padrão.",
    capabilities: { referenceImages: true, multiReference: true },
    costCredits: 30,
    avgLatencyMs: 60000,
    status: "featured",
  },
];

const PREFIXO_JOB = "mock";
const JANELA_QUEUED_MS = 800;
const JANELA_PROCESSING_MS = 2500;

// Job stateless por design — nenhum Map em memória guardando progresso
// (isso quebraria com múltiplas instâncias/restart do servidor, e o
// generation_jobs real no Postgres já é a fonte de verdade de status pro
// resto do sistema). O jobId carrega o timestamp de criação + a
// quantidade pedida; getJobStatus deriva o status só do relógio — mesmo
// princípio de função pura já usado no resto do repo (ex: montarArgsFfmpeg*).
function montarJobId(kind: string, quantity: number): string {
  return `${PREFIXO_JOB}:${kind}:${Date.now()}:${quantity}`;
}

function parseJobId(jobId: string): { kind: string; createdAtMs: number; quantity: number } | null {
  const partes = jobId.split(":");
  if (partes.length !== 4 || partes[0] !== PREFIXO_JOB) return null;
  const createdAtMs = Number(partes[2]);
  const quantity = Number(partes[3]);
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(quantity)) return null;
  return { kind: partes[1]!, createdAtMs, quantity };
}

// URLs de placeholder claramente marcadas como mock — nunca uma URL real
// de mídia (o cliente nunca deve achar que isso é uma geração de verdade;
// a UI mostra um selo "pré-visualização" enquanto só o mock está ativo).
function montarAssetsFalsos(kind: string, quantity: number): string[] {
  return Array.from({ length: Math.max(1, quantity) }, (_, i) => `mock://vetor-ai-suite/${kind}/${i + 1}`);
}

export class MockAdapter implements AIProviderAdapter {
  providerId = "mock";

  async listModels(): Promise<AIModel[]> {
    return MODELOS_MOCK;
  }

  async generate(request: GenerationRequest, _model: AIModel): Promise<{ jobId: string }> {
    return { jobId: montarJobId(request.kind, request.quantity ?? 1) };
  }

  async getJobStatus(jobId: string): Promise<GenerationJobResult> {
    const parsed = parseJobId(jobId);
    if (!parsed) return { status: "failed", error: `jobId inválido pro MockAdapter: "${jobId}"` };

    const decorridoMs = Date.now() - parsed.createdAtMs;
    if (decorridoMs < JANELA_QUEUED_MS) return { status: "queued" };
    if (decorridoMs < JANELA_PROCESSING_MS) return { status: "processing" };
    return { status: "done", resultAssetUrls: montarAssetsFalsos(parsed.kind, parsed.quantity) };
  }
}
