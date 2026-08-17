-- Onboarding operacional completo, BrandKit versionado e conexões oficiais.
-- Tudo aditivo: nenhuma coluna/linha existente de business_profiles ou
-- brand_kits é removida ou renomeada — só estende (0006_business_profiles.sql).

-- ============================================================================
-- business_profiles — campos estruturados de onboarding
-- ============================================================================

alter table business_profiles add column if not exists nome_exibicao text;
alter table business_profiles add column if not exists nome_legal text;
alter table business_profiles add column if not exists categoria text;
alter table business_profiles add column if not exists site_url text;
alter table business_profiles add column if not exists telefone_principal text;
alter table business_profiles add column if not exists whatsapp_telefone text;
alter table business_profiles add column if not exists email text;
alter table business_profiles add column if not exists endereco jsonb not null default '{}'::jsonb;
alter table business_profiles add column if not exists areas_atendimento jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists timezone text not null default 'America/Sao_Paulo';
alter table business_profiles add column if not exists horario_funcionamento jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists horario_especial jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists modalidades_atendimento jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists redes_sociais jsonb not null default '{}'::jsonb;
alter table business_profiles add column if not exists produtos_ofertas jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists objetivos jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists concorrentes jsonb not null default '[]'::jsonb;
alter table business_profiles add column if not exists sazonalidade jsonb not null default '[]'::jsonb;

-- Estado de prontidão do onboarding — mesmo raciocínio de state machine já
-- usado em missions/solicitacoes (ver apps/agentes/src/missions/stateMachine.ts),
-- só que validado no app (não há transição complexa o bastante pra justificar
-- duplicar isso em SQL agora).
alter table business_profiles add column if not exists onboarding_status text not null default 'not_started'
  check (onboarding_status in (
    'not_started', 'in_progress', 'profile_ready', 'brand_ready',
    'channels_pending', 'ready_for_first_mission', 'completed'
  ));
alter table business_profiles add column if not exists onboarding_etapa_atual text;
alter table business_profiles add column if not exists onboarding_completo_em timestamptz;
alter table business_profiles add column if not exists primeira_missao_proposta_em timestamptz;

-- ============================================================================
-- brand_kits — versão ampliada (mantém cores/fontes/logo_refs/regras legados)
-- ============================================================================

alter table brand_kits add column if not exists logo_principal_ref text;
alter table brand_kits add column if not exists logo_clara_ref text;
alter table brand_kits add column if not exists logo_escura_ref text;
alter table brand_kits add column if not exists icone_ref text;
alter table brand_kits add column if not exists estilo_visual jsonb not null default '{}'::jsonb;
alter table brand_kits add column if not exists estilos_proibidos jsonb not null default '[]'::jsonb;
alter table brand_kits add column if not exists exemplos_aprovados jsonb not null default '[]'::jsonb;
alter table brand_kits add column if not exists voz_marca jsonb not null default '{}'::jsonb;
alter table brand_kits add column if not exists palavras_permitidas jsonb not null default '[]'::jsonb;
alter table brand_kits add column if not exists palavras_proibidas jsonb not null default '[]'::jsonb;
alter table brand_kits add column if not exists status text not null default 'draft'
  check (status in ('draft', 'approved', 'archived'));

-- ============================================================================
-- connections — Instagram / WhatsApp / Meta Ads (OAuth oficial)
-- ============================================================================

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  provider text not null check (provider in ('instagram', 'whatsapp', 'meta_ads', 'meta_business')),
  external_account_id text,
  external_asset_id text,
  display_name text,
  scopes jsonb not null default '[]'::jsonb,
  encrypted_access_token text,
  encrypted_refresh_token text,
  expires_at timestamptz,
  status text not null default 'pending' check (status in (
    'pending', 'connected', 'error', 'expired', 'revoked'
  )),
  last_validated_at timestamptz,
  last_refresh_at timestamptz,
  last_error_code text,
  consent_given_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, provider, external_account_id)
);

create index if not exists idx_connections_cliente_id on connections (cliente_id);

alter table connections enable row level security;

create policy "connections: isolado por cliente" on connections
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Nunca via anon/authenticated: início/callback OAuth e troca de token rodam
-- só no backend com service_role (mesmo padrão de missions/solicitacoes) —
-- não existe policy de insert/update aqui de propósito, pra token nunca
-- passar perto do client-side.

-- Amarra o callback OAuth ao usuário/tenant/provider corretos e evita replay
-- de code — vive pouco (expires_at curto), nunca é lido pelo client-side.
create table if not exists oauth_states (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  usuario_id uuid not null references usuarios (id) on delete cascade,
  provider text not null check (provider in ('instagram', 'whatsapp', 'meta_ads', 'meta_business')),
  state text not null unique,
  code_verifier text,
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

create index if not exists idx_oauth_states_state on oauth_states (state);

alter table oauth_states enable row level security;

-- Explícito, não por omissão: nunca acessível via authenticated/anon — só
-- service_role (backend) cria e resolve state, que ignora RLS.
create policy "oauth_states: nunca acessivel por client-side"
  on oauth_states for all
  using (false)
  with check (false);

-- ============================================================================
-- Preferência de áudio + marca de saudação já reproduzida (idempotência por
-- usuário — cada login ouve a saudação uma vez, não a cada refresh).
-- ============================================================================

alter table usuarios add column if not exists welcome_audio_played_at timestamptz;
alter table usuarios add column if not exists preferencias jsonb not null default '{}'::jsonb;

-- ============================================================================
-- Snapshot de contexto de negócio por missão (Fase 4) — não versiona
-- business_profiles em linhas separadas (ainda é 1 linha mutável por
-- cliente); a versão é o timestamp de updated_at no momento da confirmação,
-- guardado em source_versions. Suficiente para auditar "que contexto o
-- Vetor usou pra planejar esta missão" sem duplicar o modelo de
-- versionamento cheio que brand_kits já tem.
-- ============================================================================

create table if not exists business_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  mission_id uuid references missions (id) on delete set null,
  brand_kit_versao integer,
  audience jsonb not null default '{}'::jsonb,
  offers jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  connected_channels jsonb not null default '[]'::jsonb,
  restrictions jsonb not null default '[]'::jsonb,
  source_versions jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_business_context_snapshots_cliente_id on business_context_snapshots (cliente_id);
create index if not exists idx_business_context_snapshots_mission_id on business_context_snapshots (mission_id);

alter table business_context_snapshots enable row level security;

create policy "business_context_snapshots: isolado por cliente" on business_context_snapshots
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- Storage — assets do BrandKit (logos, ícones, referências). Arquivo vai pro
-- bucket; só a referência (path) fica no banco (brand_kits.logo_*_ref etc.),
-- nunca o binário em coluna.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

-- Path esperado: <cliente_id>/<arquivo> — policy usa o primeiro segmento do
-- path como cliente_id, mesmo isolamento por tenant das outras tabelas.
create policy "brand-assets: cliente le os proprios arquivos"
  on storage.objects for select
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = current_cliente_id()::text
  );

create policy "brand-assets: cliente envia nos proprios arquivos"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = current_cliente_id()::text
  );

create policy "brand-assets: cliente atualiza os proprios arquivos"
  on storage.objects for update
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = current_cliente_id()::text
  );
