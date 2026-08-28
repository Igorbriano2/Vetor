// Camada de abstração de provedores de IA (suíte Image/Video/Voice/3D) —
// Fase 1 do prompt-mestre "suíte Freepik/Magnific". Contrato único que
// qualquer provider real (fal.ai, Replicate, FishAudio...) implementa —
// nunca uma tela chama um provider direto, sempre por trás deste contrato,
// pra trocar/adicionar provider sem tocar em UI/rota.

export type MediaKind = "image" | "video" | "voice" | "3d";

export type ModelStatus = "featured" | "available" | "beta" | "deprecated";

export interface AIModelCapabilities {
  referenceImages?: boolean;
  multiReference?: boolean;
  startEndFrame?: boolean;
  negativePrompt?: boolean;
  audio?: boolean;
  lipSync?: boolean;
  maxResolution?: "1080p" | "2K" | "3K" | "4K";
  durationRangeSeconds?: [number, number];
}

export interface AIModel {
  id: string; // slug interno estável, ex: "vetor-image-auto"
  providerId: string; // "mock" | "fal" | "replicate" | "fishaudio" | "anthropic"
  providerModelId: string; // id do modelo no provider real
  kind: MediaKind;
  label: string; // nome amigável mostrado ao cliente
  description?: string;
  capabilities: AIModelCapabilities;
  costCredits: number;
  avgLatencyMs: number;
  status: ModelStatus;
}

export interface GenerationRequest {
  kind: MediaKind;
  modelId: string | "auto";
  prompt?: string;
  negativePrompt?: string;
  referenceAssetIds?: string[];
  startFrameAssetId?: string;
  endFrameAssetId?: string;
  aspectRatio?: string; // "1:1" | "16:9" | "9:16" | ...
  resolution?: string;
  quantity?: number;
  durationSeconds?: number;
  extra?: Record<string, unknown>;
}

export type GenerationJobStatus = "queued" | "processing" | "done" | "failed";

export interface GenerationJobResult {
  status: GenerationJobStatus;
  resultAssetUrls?: string[];
  error?: string;
}

export interface AIProviderAdapter {
  providerId: string;
  listModels(): Promise<AIModel[]>;
  generate(request: GenerationRequest, model: AIModel): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<GenerationJobResult>;
}

export interface AutoRouter {
  pickModel(request: GenerationRequest, availableModels: AIModel[]): AIModel;
}
