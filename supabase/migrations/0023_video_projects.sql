-- Videomaker com timeline (Parte 2 da evolução de Design/Vídeo) — projeto
-- de vídeo NÃO destrutivo, timeline editável real (tracks/clips/keyframes,
-- ver apps/painel/src/lib/video/timelineTypes.ts). Mesmo raciocínio de
-- design_projects: o cliente edita a timeline_json de verdade no navegador,
-- então segue o padrão de CRUD-por-dono (não o read-only de artifacts).
-- Cada versão é sua própria linha (parent_video_project_id + version),
-- igual ao padrão já usado em design_projects/artifacts.

create table if not exists video_projects (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  mission_id uuid references missions (id) on delete cascade,
  mission_step_id uuid references mission_steps (id) on delete cascade,
  solicitacao_id uuid references solicitacoes (id) on delete set null,
  parent_video_project_id uuid references video_projects (id) on delete set null,
  title text not null,
  width integer not null,
  height integer not null,
  fps integer not null default 30,
  duration_ms integer not null default 0,
  timeline_version integer not null default 1,
  -- TimelineDocument (tracks/markers/settings/captions?/audioMix?) — nunca
  -- um MP4 opaco só: esta é a fonte de verdade editável, o MP4 final
  -- (output_url) é sempre DERIVADO dela (ver Parte 5 da spec).
  timeline_json jsonb not null default '{}'::jsonb,
  -- Vídeo de referência (Parte 3) anexado pelo cliente — aponta pro
  -- perfil derivado da análise, não pro arquivo bruto. Sem FK ainda: a
  -- tabela reference_video_profiles chega na Parte 3 (rodada seguinte);
  -- fica solto por enquanto, nunca usado sem checagem de tenant no código.
  reference_video_id uuid,
  status text not null default 'draft' check (status in (
    'draft', 'analyzing', 'editing', 'awaiting_approval', 'rendering', 'completed', 'failed'
  )),
  -- Guardam STORAGE PATH, nunca URL assinada (mesmo raciocínio do
  -- vetorMeta.storagePath em design_projects.canvas_json — URL assinada
  -- expira, o path não). O painel resolve uma URL fresca na leitura.
  proxy_storage_path text,
  preview_storage_path text,
  output_storage_path text,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_projects_cliente_id on video_projects (cliente_id);
create index if not exists idx_video_projects_mission_id on video_projects (mission_id);
create index if not exists idx_video_projects_parent on video_projects (parent_video_project_id);

alter table video_projects enable row level security;

create policy "video_projects: isolado por cliente" on video_projects
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "video_projects: cliente cria os proprios" on video_projects
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "video_projects: cliente edita os proprios" on video_projects
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor')
  with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Nunca delete físico — versão vira "failed"/status arquivado quando
-- descartada, preserva histórico de edição/aprovação como o resto do
-- produto já faz.
