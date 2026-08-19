-- ReferenceVideoProfile (Parte 3 da evolução de Design/Vídeo) — perfil
-- derivado de um vídeo de referência anexado pelo cliente (ex: concorrente,
-- vídeo viral, exemplo de estilo desejado). Orienta decisões de edição do
-- agente de Vídeo; nunca é copiado/reutilizado como asset em si — só o
-- PERFIL (ritmo, densidade de corte, estilo de legenda etc.) é extraído,
-- nunca o conteúdo. Mesma política de RLS isolado-por-cliente do resto do
-- produto. Cada linha é uma análise imutável (nunca update — refazer a
-- análise cria uma linha nova, igual ao padrão de versão do resto do
-- Vídeo/Design).

create table if not exists reference_video_profiles (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  source_asset_id uuid not null references business_assets (id) on delete cascade,
  duration_ms integer not null,
  aspect_ratio text not null,
  -- Sinal real (ffmpeg scene-detect, ver apps/render) — nunca estimado.
  cut_density_per_minute numeric not null,
  average_shot_duration_ms integer not null,
  pacing text not null check (pacing in ('slow', 'medium', 'fast')),
  -- Descrição em linguagem natural (Claude vision sobre frames reais
  -- extraídos do vídeo) — nunca invenção sem base visual.
  hook_structure text not null,
  caption_style jsonb not null default '{}'::jsonb,
  -- Só "cut" é detectável hoje (ver apps/render/src/ffmpeg/sceneDetect.ts)
  -- — nunca populado com fade/wipe/dissolve sem uma técnica real por trás.
  transitions_used text[] not null default '{}',
  music_energy text not null check (music_energy in ('low', 'medium', 'high')),
  relative_volume_db numeric,
  -- Sem detector de eventos de áudio hoje — sempre vazio, nunca inventado
  -- (ver referenceVideoAnalysis.ts).
  sound_effects_used text[] not null default '{}',
  color_profile text not null,
  composition_notes text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reference_video_profiles_cliente_id on reference_video_profiles (cliente_id);
create index if not exists idx_reference_video_profiles_source_asset on reference_video_profiles (source_asset_id);

alter table reference_video_profiles enable row level security;

create policy "reference_video_profiles: isolado por cliente" on reference_video_profiles
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "reference_video_profiles: cliente cria os proprios" on reference_video_profiles
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Análise é imutável: sem policy de update/delete (refazer = nova linha).

-- Agora que a tabela existe, fecha a referência solta deixada em
-- video_projects.reference_video_id (migration 0023) com uma FK de verdade.
alter table video_projects
  add constraint video_projects_reference_video_id_fkey
  foreign key (reference_video_id) references reference_video_profiles (id) on delete set null;
