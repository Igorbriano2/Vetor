-- Vetor — schema inicial (MVP)
-- Ver docs/04-especificacao-tecnica-e-stack.md (secao 3) e docs/05 (assinaturas).
-- Multi-tenancy: cada linha das tabelas de negocio pertence a um cliente_id.
-- RLS garante que um cliente nunca ve dado de outro cliente.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tabelas
-- ============================================================================

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null,
  nicho text not null check (nicho in (
    'restaurante_delivery', 'advocacia', 'arquitetura_engenharia', 'saude', 'estetica', 'outro'
  )),
  plano_id text check (plano_id in ('design', 'social_media', 'duplo', 'trafego', 'completo')),
  status_assinatura text not null default 'em_teste' check (status_assinatura in (
    'ativa', 'atrasada', 'cancelada', 'em_teste'
  )),
  manual_marca jsonb,
  created_at timestamptz not null default now()
);

-- Contatos de cada cliente com acesso ao painel. id = auth.users.id (1:1).
create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome text not null,
  papel text not null default 'cliente' check (papel in ('cliente', 'admin_vetor')),
  created_at timestamptz not null default now()
);

create table if not exists demandas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo_demanda text not null,
  descricao text not null,
  urgencia text not null default 'media' check (urgencia in ('baixa', 'media', 'alta')),
  status text not null default 'novo' check (status in (
    'novo', 'em_andamento', 'aguardando_aprovacao', 'concluida', 'cancelada'
  )),
  contexto_anterior text,
  created_at timestamptz not null default now()
);

create table if not exists entregas (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references demandas (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo text not null,
  status text not null default 'rascunho' check (status in (
    'rascunho', 'pendente_aprovacao', 'aprovada', 'rejeitada', 'publicada'
  )),
  arquivo_url text,
  created_at timestamptz not null default now()
);

create table if not exists campanhas_trafego (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome text not null,
  meta_campaign_id text,
  orcamento_centavos integer,
  teto_custo_resultado_centavos integer,
  status text not null default 'rascunho',
  metricas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conteudo_social (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  demanda_id uuid references demandas (id) on delete set null,
  titulo text,
  legenda text,
  formato text check (formato in ('feed', 'story', 'reel', 'carrossel')),
  status text not null default 'rascunho' check (status in (
    'rascunho', 'pendente_aprovacao', 'aprovado', 'agendado', 'publicado'
  )),
  agendado_para timestamptz,
  publicado_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists assinaturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references clientes (id) on delete cascade,
  plano_id text not null check (plano_id in ('design', 'social_media', 'duplo', 'trafego', 'completo')),
  asaas_customer_id text,
  asaas_subscription_id text,
  status text not null default 'em_teste' check (status in ('ativa', 'atrasada', 'cancelada', 'em_teste')),
  valor_mensal_centavos integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  conteudo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Auditoria: toda acao tomada por um agente de IA, com justificativa.
create table if not exists log_agentes (
  id uuid primary key default gen_random_uuid(),
  agente text not null,
  cliente_id uuid references clientes (id) on delete set null,
  demanda_id uuid references demandas (id) on delete set null,
  acao text not null,
  justificativa text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usuarios_cliente_id on usuarios (cliente_id);
create index if not exists idx_demandas_cliente_id on demandas (cliente_id);
create index if not exists idx_demandas_status on demandas (status);
create index if not exists idx_entregas_cliente_id on entregas (cliente_id);
create index if not exists idx_entregas_demanda_id on entregas (demanda_id);
create index if not exists idx_campanhas_trafego_cliente_id on campanhas_trafego (cliente_id);
create index if not exists idx_conteudo_social_cliente_id on conteudo_social (cliente_id);
create index if not exists idx_relatorios_cliente_id on relatorios (cliente_id);
create index if not exists idx_log_agentes_cliente_id on log_agentes (cliente_id);

-- ============================================================================
-- Helper para RLS: cliente_id do usuario autenticado.
-- security definer para nao recursar nas policies da propria tabela usuarios.
-- ============================================================================

create or replace function current_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cliente_id from usuarios where id = auth.uid()
$$;

create or replace function current_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from usuarios where id = auth.uid()
$$;

-- ============================================================================
-- Row Level Security — isolamento por conta (multi-tenancy)
-- admin_vetor enxerga tudo; cliente so enxerga o proprio cliente_id.
-- Escrita/leitura ampla para o backend dos agentes acontece via service_role,
-- que ignora RLS por padrao (nao precisa de policy propria).
-- ============================================================================

alter table clientes enable row level security;
alter table usuarios enable row level security;
alter table demandas enable row level security;
alter table entregas enable row level security;
alter table campanhas_trafego enable row level security;
alter table conteudo_social enable row level security;
alter table assinaturas enable row level security;
alter table relatorios enable row level security;
alter table log_agentes enable row level security;

create policy "clientes: proprio ou admin" on clientes
  for select using (id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "usuarios: proprio cliente ou admin" on usuarios
  for select using (
    id = auth.uid() or cliente_id = current_cliente_id() or current_papel() = 'admin_vetor'
  );

create policy "demandas: isolado por cliente" on demandas
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "demandas: cliente pode criar as proprias" on demandas
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "entregas: isolado por cliente" on entregas
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "campanhas_trafego: isolado por cliente" on campanhas_trafego
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "conteudo_social: isolado por cliente" on conteudo_social
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "assinaturas: isolado por cliente" on assinaturas
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "relatorios: isolado por cliente" on relatorios
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "log_agentes: isolado por cliente" on log_agentes
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
