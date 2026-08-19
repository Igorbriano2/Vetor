-- Pipeline do agente de vídeo (Parte 4) — estágios PERSISTIDOS, não um
-- fluxo em memória que se perde se o worker cair no meio. Cada linha é
-- uma tentativa de um estágio pra um video_project; idempotência vem da
-- constraint única (video_project_id, stage) + o código sempre checa
-- "já tem uma linha completed pra este estágio?" antes de refazer o
-- trabalho — nunca reprocessa (e nunca cobra de novo de um provider) um
-- estágio que já terminou com sucesso.
--
-- Read-only pro cliente (mesmo padrão de agent_runs): só o backend
-- (service_role) grava aqui, o painel só lê pra mostrar progresso.
create table if not exists video_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  video_project_id uuid not null references video_projects (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  stage text not null check (stage in (
    'upload',
    'proxy',
    'media_analysis',
    'transcription',
    'scene_detection',
    'reference_profile',
    'editorial_plan',
    'timeline_draft',
    'cuts_pacing',
    'captions',
    'sound_effects_mix',
    'music_ducking',
    'transitions_effects',
    'preview',
    'critique',
    'revision',
    'approval',
    'final_render'
  )),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  attempts integer not null default 0,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_project_id, stage)
);

create index if not exists idx_video_pipeline_stages_project on video_pipeline_stages (video_project_id);
create index if not exists idx_video_pipeline_stages_cliente on video_pipeline_stages (cliente_id);

alter table video_pipeline_stages enable row level security;

create policy "video_pipeline_stages: isolado por cliente" on video_pipeline_stages
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
