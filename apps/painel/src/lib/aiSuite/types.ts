// Espelha apps/agentes/src/ai-providers/types.ts — painel e agentes são
// deploys separados (nunca compartilham import direto), então o formato
// vindo da API é replicado aqui como tipo puro, sem lógica.

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
  id: string;
  providerId: string;
  providerModelId: string;
  kind: MediaKind;
  label: string;
  description?: string;
  capabilities: AIModelCapabilities;
  costCredits: number;
  avgLatencyMs: number;
  status: ModelStatus;
}

export type GenerationJobStatus = "queued" | "processing" | "done" | "failed";

export interface GenerationJob {
  id: string;
  cliente_id: string;
  kind: MediaKind;
  model_id: string;
  provider_id: string;
  provider_job_id: string | null;
  status: GenerationJobStatus;
  request: Record<string, unknown>;
  result_asset_urls: string[];
  error: string | null;
  cost_credits: number;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  media_kind: string;
  niche: "restaurante" | "advocacia" | "clinica" | "geral";
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  prompt_or_config: Record<string, unknown>;
}
