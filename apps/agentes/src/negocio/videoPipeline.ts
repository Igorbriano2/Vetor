// Pipeline do agente de vídeo (Parte 4) — estágios PERSISTIDOS em
// video_pipeline_stages, nunca em memória (um worker que reinicia no meio
// não pode perder o progresso nem refazer trabalho já pago a um
// provider). Idempotência: antes de rodar um estágio, sempre checa se já
// existe uma linha "completed" pra ele — se sim, devolve o resultado
// salvo em vez de reprocessar.

import { supabase } from "../db/supabase.js";

export type EstagioPipelineVideo =
  | "upload"
  | "proxy"
  | "media_analysis"
  | "transcription"
  | "scene_detection"
  | "reference_profile"
  | "editorial_plan"
  | "timeline_draft"
  | "cuts_pacing"
  | "captions"
  | "sound_effects_mix"
  | "music_ducking"
  | "transitions_effects"
  | "preview"
  | "critique"
  | "revision"
  | "approval"
  | "final_render";

interface LinhaEstagio {
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  attempts: number;
  result: unknown;
}

async function buscarEstagio(videoProjectId: string, stage: EstagioPipelineVideo): Promise<LinhaEstagio | null> {
  const { data } = await supabase
    .from("video_pipeline_stages")
    .select("status, attempts, result")
    .eq("video_project_id", videoProjectId)
    .eq("stage", stage)
    .maybeSingle();
  if (!data) return null;
  return { status: data.status as LinhaEstagio["status"], attempts: data.attempts as number, result: data.result };
}

async function marcarRodando(videoProjectId: string, clienteId: string, stage: EstagioPipelineVideo, tentativaAnterior: number): Promise<void> {
  await supabase.from("video_pipeline_stages").upsert(
    {
      video_project_id: videoProjectId,
      cliente_id: clienteId,
      stage,
      status: "running",
      attempts: tentativaAnterior + 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "video_project_id,stage" },
  );
}

async function marcarConcluido(videoProjectId: string, stage: EstagioPipelineVideo, result: unknown): Promise<void> {
  await supabase
    .from("video_pipeline_stages")
    .update({ status: "completed", result, error: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("video_project_id", videoProjectId)
    .eq("stage", stage);
}

async function marcarFalhou(videoProjectId: string, stage: EstagioPipelineVideo, erro: string): Promise<void> {
  await supabase
    .from("video_pipeline_stages")
    .update({ status: "failed", error: erro, updated_at: new Date().toISOString() })
    .eq("video_project_id", videoProjectId)
    .eq("stage", stage);
}

// Marca um estágio como intencionalmente não executado (ex: transcrição
// pulada porque o vídeo não tem áudio) — diferente de "failed", nunca
// aparece como erro pro cliente, só como "não se aplicou".
export async function pularEstagio(videoProjectId: string, clienteId: string, stage: EstagioPipelineVideo, motivo: string): Promise<void> {
  await supabase.from("video_pipeline_stages").upsert(
    {
      video_project_id: videoProjectId,
      cliente_id: clienteId,
      stage,
      status: "skipped",
      result: { motivo },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "video_project_id,stage" },
  );
}

// Roda um estágio de forma idempotente: se já tem um resultado
// "completed" salvo, devolve ele sem chamar `fn` de novo (nunca reprocessa
// nem cobra duas vezes de um provider por causa de um retry). Se falhar,
// grava o erro e relança — quem chama decide se para a missão ou tenta de
// novo depois.
export async function executarEstagioIdempotente<T>(
  videoProjectId: string,
  clienteId: string,
  stage: EstagioPipelineVideo,
  fn: () => Promise<T>,
): Promise<T> {
  const existente = await buscarEstagio(videoProjectId, stage);
  if (existente?.status === "completed") return existente.result as T;

  await marcarRodando(videoProjectId, clienteId, stage, existente?.attempts ?? 0);
  try {
    const resultado = await fn();
    await marcarConcluido(videoProjectId, stage, resultado);
    return resultado;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido";
    await marcarFalhou(videoProjectId, stage, mensagem);
    throw err;
  }
}
