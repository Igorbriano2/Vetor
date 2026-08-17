import { supabase } from "../db/supabase.js";

// Pipeline de artefatos — toda etapa que promete uma entrega precisa passar
// por aqui antes de virar "completed" (ver missions/orchestrator.ts,
// exigirArtefatoOuFalhar). Um artefato é sempre uma linha real e consultável
// em `artifacts`, nunca só uma frase no resultado do especialista.

export type ArtifactType = "image" | "video" | "copy" | "document" | "report" | "plan" | "campaign_snapshot";
export type ArtifactStatus = "processing" | "ready" | "awaiting_approval" | "approved" | "rejected" | "failed" | "archived";

export interface ArtifactoParaPersistir {
  clienteId: string;
  missionId?: string;
  missionStepId?: string;
  solicitacaoId?: string;
  type: ArtifactType;
  department: string;
  title: string;
  description?: string;
  // Um dos dois: conteúdo de texto puro (copy/document/plan/report gerado
  // pelo próprio LLM, sem arquivo binário) OU referência de arquivo real
  // (bucket próprio via storagePath, ou CDN externo via externalUrl — nunca
  // os dois, nunca nenhum: um artefato sem conteúdo nem arquivo não é real).
  content?: string;
  storagePath?: string;
  externalUrl?: string;
  mimeType?: string;
  durationSeconds?: number;
  criadoPorAgente: string;
  // Dados estruturados além do texto — usado por type=plan (calendário,
  // indicadores, período) sem precisar de tabela própria pro planejamento
  // (reaproveita artifacts, já versionado via version/parent_artifact_id).
  metadataExtra?: Record<string, unknown>;
}

export interface ArtefatoPersistido {
  id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  previewUrl?: string;
  downloadUrl?: string;
}

export class ArtefatoSemConteudoError extends Error {
  constructor(title: string) {
    super(`Artefato "${title}" não tem conteúdo nem arquivo — nunca persiste um artefato vazio.`);
    this.name = "ArtefatoSemConteudoError";
  }
}

export async function persistirArtefato(dados: ArtifactoParaPersistir): Promise<ArtefatoPersistido> {
  if (!dados.content && !dados.storagePath && !dados.externalUrl) {
    throw new ArtefatoSemConteudoError(dados.title);
  }

  const storageProvider = dados.storagePath ? "supabase" : dados.externalUrl ? "external" : null;
  const storagePath = dados.storagePath ?? dados.externalUrl ?? null;

  const { data, error } = await supabase
    .from("artifacts")
    .insert({
      cliente_id: dados.clienteId,
      mission_id: dados.missionId ?? null,
      mission_step_id: dados.missionStepId ?? null,
      solicitacao_id: dados.solicitacaoId ?? null,
      type: dados.type,
      department: dados.department,
      title: dados.title,
      description: dados.description ?? null,
      status: "ready",
      storage_provider: storageProvider,
      storage_path: storagePath,
      mime_type: dados.mimeType ?? null,
      duration_seconds: dados.durationSeconds ?? null,
      metadata: { ...(dados.content ? { content: dados.content } : {}), ...(dados.metadataExtra ?? {}) },
      created_by_agent: dados.criadoPorAgente,
    })
    .select("id, type, title, status")
    .single();

  if (error || !data) throw new Error(`Falha ao persistir artefato "${dados.title}": ${error?.message}`);

  const url = await urlDoArtefato(storageProvider, storagePath);

  return {
    id: data.id as string,
    type: data.type as ArtifactType,
    title: data.title as string,
    status: data.status as ArtifactStatus,
    previewUrl: url ?? undefined,
    downloadUrl: url ?? undefined,
  };
}

async function urlDoArtefato(provider: string | null, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (provider === "external") return path;
  if (provider === "supabase") {
    const { data } = await supabase.storage.from("artifacts").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }
  return null;
}

export async function listarArtefatosDaMissao(missionId: string): Promise<
  Array<{ id: string; missionStepId: string | null; type: ArtifactType; title: string; status: ArtifactStatus; previewUrl?: string }>
> {
  const { data, error } = await supabase
    .from("artifacts")
    .select("id, mission_step_id, type, title, status, storage_provider, storage_path")
    .eq("mission_id", missionId);
  if (error) throw new Error(`Falha ao listar artefatos da missão ${missionId}: ${error.message}`);

  return Promise.all(
    (data ?? []).map(async (a) => ({
      id: a.id as string,
      missionStepId: a.mission_step_id as string | null,
      type: a.type as ArtifactType,
      title: a.title as string,
      status: a.status as ArtifactStatus,
      previewUrl: (await urlDoArtefato(a.storage_provider as string | null, a.storage_path as string | null)) ?? undefined,
    })),
  );
}
