// Videomaker (Parte 2/4) — cria o video_project editável a partir de um
// upload real do cliente. Mesmo raciocínio de designProjects.ts: o
// video_project é a CAMADA EDITÁVEL (timeline não destrutiva) em cima do
// arquivo bruto enviado, nunca substitui o arquivo original. Tipos aqui
// são um subconjunto mínimo de apps/painel/src/lib/video/timelineTypes.ts
// (mesma convenção já usada entre design_projects e o app painel: cada
// lado duplica só o que precisa, sem depender de um pacote compartilhado).

import { randomUUID } from "node:crypto";
import { supabase } from "../db/supabase.js";

interface TimelineClipeInicial {
  id: string;
  sourceAssetId: string;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  trimOutMs: number;
  speed: number;
  volume: number;
  transform: { x: number; y: number; scale: number; rotationDeg: number; opacity: number };
  effects: string[];
  keyframes: unknown[];
}

export interface MontarTimelineInicialParams {
  sourceAssetId: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
}

// Timeline com UMA faixa de vídeo e UM clip cobrindo o arquivo enviado
// inteiro (trimIn=0, trimOut=duração real) — o cliente corta/edita a
// partir daqui no editor (task #78), nunca um MP4 opaco só.
export function montarTimelineInicial(params: MontarTimelineInicialParams): unknown {
  const clipe: TimelineClipeInicial = {
    id: randomUUID(),
    sourceAssetId: params.sourceAssetId,
    startMs: 0,
    durationMs: params.durationMs,
    trimInMs: 0,
    trimOutMs: params.durationMs,
    speed: 1,
    volume: 1,
    transform: { x: 0, y: 0, scale: 1, rotationDeg: 0, opacity: 1 },
    effects: [],
    keyframes: [],
  };

  return {
    tracks: [
      {
        id: randomUUID(),
        kind: "video",
        name: "Vídeo principal",
        locked: false,
        muted: false,
        hidden: false,
        clips: [clipe],
      },
    ],
    markers: [],
    settings: { fps: params.fps, width: params.width, height: params.height },
  };
}

export interface CriarVideoProjectParams {
  clienteId: string;
  missionId?: string;
  missionStepId?: string;
  solicitacaoId?: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  timelineJson: unknown;
  proxyStoragePath?: string;
}

// Insert de verdade — apps/agentes usa a chave service_role (bypassa
// RLS), mesmo caminho que persistirArtefato()/criarDesignProject() já
// usam.
export async function criarVideoProject(params: CriarVideoProjectParams): Promise<{ id: string; timelineVersion: number }> {
  const { data, error } = await supabase
    .from("video_projects")
    .insert({
      cliente_id: params.clienteId,
      mission_id: params.missionId ?? null,
      mission_step_id: params.missionStepId ?? null,
      solicitacao_id: params.solicitacaoId ?? null,
      title: params.title,
      width: params.width,
      height: params.height,
      fps: params.fps,
      duration_ms: params.durationMs,
      timeline_version: 1,
      timeline_json: params.timelineJson,
      status: "editing",
      proxy_storage_path: params.proxyStoragePath ?? null,
    })
    .select("id, timeline_version")
    .single();

  if (error || !data) throw new Error(`Falha ao criar video_project: ${error?.message}`);
  return { id: data.id as string, timelineVersion: data.timeline_version as number };
}

export interface RascunhoVideoProjectParams {
  clienteId: string;
  missionId?: string;
  missionStepId: string;
  solicitacaoId?: string;
  title: string;
  width: number;
  height: number;
  fps: number;
}

// Cria (ou reaproveita) o video_project pra uma etapa de missão —
// idempotente por mission_step_id: se a etapa já criou um projeto antes
// (retry depois de um estágio seguinte falhar), reaproveita o mesmo em
// vez de criar um duplicado. mission_step_id é a chave certa aqui porque
// o video_project ainda não existe na primeira tentativa (bootstrap:
// não dá pra chavear pelo próprio id que ainda não foi gerado).
export async function buscarOuCriarVideoProjectRascunho(
  params: RascunhoVideoProjectParams,
): Promise<{ id: string; timelineVersion: number; jaExistia: boolean }> {
  const { data: existente } = await supabase
    .from("video_projects")
    .select("id, timeline_version")
    .eq("mission_step_id", params.missionStepId)
    .maybeSingle();
  if (existente) return { id: existente.id as string, timelineVersion: existente.timeline_version as number, jaExistia: true };

  const criado = await criarVideoProject({
    clienteId: params.clienteId,
    missionId: params.missionId,
    missionStepId: params.missionStepId,
    solicitacaoId: params.solicitacaoId,
    title: params.title,
    width: params.width,
    height: params.height,
    fps: params.fps,
    durationMs: 0,
    timelineJson: { tracks: [], markers: [], settings: { fps: params.fps, width: params.width, height: params.height } },
  });
  return { ...criado, jaExistia: false };
}

// Preenche a timeline real (chamado pelo estágio "timeline_draft") — só
// depois que o proxy real já existe, então já tem a duração de verdade
// do arquivo. Grava também o proxy_storage_path e a duração no projeto.
export async function atualizarTimelineDoVideoProject(
  videoProjectId: string,
  timelineJson: unknown,
  durationMs: number,
  proxyStoragePath: string,
): Promise<void> {
  const { error } = await supabase
    .from("video_projects")
    .update({
      timeline_json: timelineJson,
      duration_ms: durationMs,
      proxy_storage_path: proxyStoragePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", videoProjectId);
  if (error) throw new Error(`Falha ao atualizar a timeline do video_project: ${error.message}`);
}

interface CaptionCueMinima {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

interface CaptionTrackMinima {
  cues: CaptionCueMinima[];
  language: "pt-BR";
}

// Converte segmentos brutos da transcrição (transcricao.ts) em cues
// EDITÁVEIS de verdade — cada cue ganha um id próprio pra virar um
// layer/item independente na timeline, nunca texto achatado. Pura, sem I/O.
export function montarCaptionTrackDeSegmentos(segmentos: Array<{ startMs: number; endMs: number; text: string }>): CaptionTrackMinima {
  return {
    cues: segmentos.map((s) => ({ id: randomUUID(), startMs: s.startMs, endMs: s.endMs, text: s.text })),
    language: "pt-BR",
  };
}

// Mescla o CaptionTrack real dentro do timeline_json existente — lê o
// estado atual primeiro pra nunca sobrescrever tracks/markers já editados
// pelo cliente no editor (achado do editor: captions e clipes de vídeo são
// camadas independentes da MESMA timeline, não documentos separados).
export async function atualizarCaptionsDoVideoProject(videoProjectId: string, captions: CaptionTrackMinima): Promise<void> {
  const { data: atual, error: erroLeitura } = await supabase
    .from("video_projects")
    .select("timeline_json")
    .eq("id", videoProjectId)
    .single();
  if (erroLeitura || !atual) throw new Error(`Falha ao ler o video_project para mesclar captions: ${erroLeitura?.message}`);

  const timelineAtual = (atual.timeline_json ?? {}) as Record<string, unknown>;
  const novaTimeline = { ...timelineAtual, captions };

  const { error } = await supabase
    .from("video_projects")
    .update({ timeline_json: novaTimeline, updated_at: new Date().toISOString() })
    .eq("id", videoProjectId);
  if (error) throw new Error(`Falha ao gravar captions no video_project: ${error.message}`);
}

// Preenche o proxy de um video_project que nunca passou por
// editar_video_timeline (rascunho criado direto no editor manual via "+
// Novo vídeo") — achado da auditoria pré-demo: finalizar_video recusava
// esses rascunhos com "ainda não tem proxy" mesmo quando a timeline já
// tinha clipes de verdade prontos pra render. Chamado sob demanda por
// finalizar_video antes de gerar legenda/preview, nunca sobrescreve uma
// timeline já existente (só o campo do proxy).
export async function atualizarProxyDoVideoProject(videoProjectId: string, proxyStoragePath: string): Promise<void> {
  const { error } = await supabase
    .from("video_projects")
    .update({ proxy_storage_path: proxyStoragePath, updated_at: new Date().toISOString() })
    .eq("id", videoProjectId);
  if (error) throw new Error(`Falha ao gravar o proxy do video_project: ${error.message}`);
}

// Grava o preview (mesma timeline do editor, renderizado — nunca uma
// versão paralela). Chamado pelo estágio "preview".
export async function atualizarPreviewDoVideoProject(videoProjectId: string, previewStoragePath: string): Promise<void> {
  const { error } = await supabase
    .from("video_projects")
    .update({ preview_storage_path: previewStoragePath, updated_at: new Date().toISOString() })
    .eq("id", videoProjectId);
  if (error) throw new Error(`Falha ao gravar o preview do video_project: ${error.message}`);
}

// Grava o resultado do render final + marca o projeto como concluído —
// chamado pelo estágio "final_render", só depois que o MP4 real já subiu
// pro storage (nunca marca completed antes do arquivo existir de verdade).
export async function atualizarRenderFinalDoVideoProject(videoProjectId: string, outputStoragePath: string): Promise<void> {
  const { error } = await supabase
    .from("video_projects")
    .update({ output_storage_path: outputStoragePath, status: "completed", updated_at: new Date().toISOString() })
    .eq("id", videoProjectId);
  if (error) throw new Error(`Falha ao gravar o render final do video_project: ${error.message}`);
}
