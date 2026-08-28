-- Suíte de IA (Image/Video/Voice/Design/3D) — Fase 2 do prompt-mestre
-- "reproduzir a suíte Freepik/Magnific dentro do Vetor" (ver
-- docs/arquitetura-suite-ia.md). Modelo de dados mínimo: catálogo de
-- modelos, fila de geração, ledger de créditos, templates por nicho,
-- biblioteca de vozes. Mesmo padrão RLS já usado em toda a base
-- (isolado por cliente_id; catálogos compartilhados usam cliente_id
-- NULO = curado pelo time Vetor, mesmo desenho já usado em
-- reference_library_items desde o upgrade Gravyx).

-- ============================================================================
-- ai_models — catálogo de modelos disponíveis (curado pelo time Vetor,
-- nunca por cliente nesta rodada — cliente_id sempre nulo hoje, mas a
-- coluna já existe pra permitir modelo customizado por cliente no futuro
-- sem migration nova). Ligar/desligar um modelo é um update aqui, nunca
-- deploy.
-- ============================================================================

create table if not exists ai_models (
  id text primary key,
  cliente_id uuid references clientes (id) on delete cascade,
  provider_id text not null,
  provider_model_id text not null,
  kind text not null check (kind in ('image', 'video', 'voice', '3d')),
  label text not null,
  description text,
  capabilities jsonb not null default '{}'::jsonb,
  cost_credits integer not null default 0,
  avg_latency_ms integer not null default 0,
  status text not null default 'available' check (status in ('featured', 'available', 'beta', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_models_kind on ai_models (kind);
create index if not exists idx_ai_models_cliente_id on ai_models (cliente_id);

alter table ai_models enable row level security;

create policy "ai_models: proprio, curado, ou admin" on ai_models
  for select using (cliente_id = current_cliente_id() or cliente_id is null or current_papel() = 'admin_vetor');
create policy "ai_models: só admin cadastra" on ai_models
  for insert with check (current_papel() = 'admin_vetor');
create policy "ai_models: só admin edita" on ai_models
  for update using (current_papel() = 'admin_vetor');
create policy "ai_models: só admin apaga" on ai_models
  for delete using (current_papel() = 'admin_vetor');

-- ============================================================================
-- generation_jobs — toda geração (imagem/vídeo/voz/3d) do "estúdio direto"
-- passa por aqui, ligada ao AIModel usado e ao provider_job_id real (o
-- jobId devolvido por AIProviderAdapter.generate()). Dá de graça o
-- histórico ("Minhas criações") e a base do débito de crédito.
-- ============================================================================

create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'voice', '3d')),
  model_id text not null references ai_models (id),
  provider_id text not null,
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  request jsonb not null default '{}'::jsonb,
  result_asset_urls text[] not null default '{}',
  error text,
  cost_credits integer not null default 0,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_generation_jobs_cliente_id on generation_jobs (cliente_id);
create index if not exists idx_generation_jobs_status on generation_jobs (status);
create index if not exists idx_generation_jobs_kind on generation_jobs (kind);

alter table generation_jobs enable row level security;

create policy "generation_jobs: isolado por cliente" on generation_jobs
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "generation_jobs: cliente cria as proprias" on generation_jobs
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "generation_jobs: cliente edita as proprias" on generation_jobs
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- credit_ledger — entradas (concessão de plano, estorno) e saídas (débito
-- de geração) de crédito. Nunca um saldo solto num campo `creditos` de
-- outra tabela — o saldo é sempre a SOMA desta tabela, auditável linha a
-- linha (mesmo princípio de agent_runs.custo_estimado_centavos, só que
-- aqui é dinheiro de crédito de verdade, não observabilidade).
-- ============================================================================

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  delta_credits integer not null,
  reason text not null check (reason in ('generation_debit', 'generation_refund', 'plan_grant', 'manual_adjustment')),
  generation_job_id uuid references generation_jobs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_ledger_cliente_id on credit_ledger (cliente_id);

alter table credit_ledger enable row level security;

create policy "credit_ledger: isolado por cliente" on credit_ledger
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "credit_ledger: sistema/admin grava" on credit_ledger
  for insert with check (current_papel() = 'admin_vetor');

-- ============================================================================
-- templates — peças prontas por nicho, compartilhadas entre TODOS os
-- módulos (Image/Video/Voice/Design/3D) via media_kind, mesmo padrão de
-- catálogo curado (cliente_id nulo) de ai_models/reference_library_items.
-- ============================================================================

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes (id) on delete cascade,
  media_kind text not null check (media_kind in ('image', 'video', 'voice', 'design', '3d')),
  niche text not null default 'geral' check (niche in ('restaurante', 'advocacia', 'clinica', 'geral')),
  title text not null,
  description text,
  thumbnail_url text,
  prompt_or_config jsonb not null default '{}'::jsonb,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_templates_media_kind on templates (media_kind);
create index if not exists idx_templates_niche on templates (niche);
create index if not exists idx_templates_cliente_id on templates (cliente_id);

alter table templates enable row level security;

create policy "templates: proprio, curado, ou admin" on templates
  for select using (cliente_id = current_cliente_id() or cliente_id is null or current_papel() = 'admin_vetor');
create policy "templates: cliente cria os proprios" on templates
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "templates: cliente edita os proprios" on templates
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "templates: cliente apaga os proprios" on templates
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- voices — biblioteca de vozes (provider real: FishAudio, ver decisão em
-- docs/arquitetura-suite-ia.md seção 4; nesta rodada só a mock). cliente_id
-- nulo = biblioteca global; não-nulo fica reservado pra voz clonada própria
-- do cliente numa rodada futura.
-- ============================================================================

create table if not exists voices (
  id text primary key,
  cliente_id uuid references clientes (id) on delete cascade,
  provider_id text not null,
  provider_voice_id text not null,
  nome text not null,
  idioma text not null default 'pt-BR',
  genero text,
  sotaque text,
  preview_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_voices_idioma on voices (idioma);
create index if not exists idx_voices_cliente_id on voices (cliente_id);

alter table voices enable row level security;

create policy "voices: proprio, curado, ou admin" on voices
  for select using (cliente_id = current_cliente_id() or cliente_id is null or current_papel() = 'admin_vetor');
create policy "voices: só admin cadastra" on voices
  for insert with check (current_papel() = 'admin_vetor');
create policy "voices: só admin edita" on voices
  for update using (current_papel() = 'admin_vetor');
create policy "voices: só admin apaga" on voices
  for delete using (current_papel() = 'admin_vetor');
