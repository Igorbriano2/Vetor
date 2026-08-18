-- Drive de ativos empresariais — estende business_assets (0016), nunca
-- recria. Tudo aditivo: nenhuma coluna/policy existente é removida.
-- Genérico por design: nenhuma categoria/campo é específico de restaurante
-- (Dog King é só o cliente de teste usado pra validar).

-- ============================================================================
-- Pastas reais (hierarquia) — "pasta" (texto livre) em business_assets
-- continua existindo por compatibilidade, mas passa a ser preenchida a
-- partir do nome da pasta estruturada quando o cliente usa o Drive novo.
-- ============================================================================

create table if not exists business_asset_folders (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  parent_id uuid references business_asset_folders (id) on delete cascade,
  nome text not null,
  categoria text check (categoria in (
    'identidade_visual', 'produtos_servicos', 'pessoas_especialistas',
    'ambientes_operacao', 'campanhas_referencias', 'documentos_contexto', 'outro'
  )),
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_asset_folders_cliente_id on business_asset_folders (cliente_id);
create index if not exists idx_business_asset_folders_parent_id on business_asset_folders (parent_id);

alter table business_asset_folders enable row level security;

create policy "business_asset_folders: isolado por cliente" on business_asset_folders
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_asset_folders: cliente cria as proprias" on business_asset_folders
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_asset_folders: cliente edita as proprias" on business_asset_folders
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_asset_folders: cliente apaga as proprias" on business_asset_folders
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- business_assets — campos novos pro Drive completo. status default
-- 'aprovado' preserva o comportamento atual (upload já fica utilizável na
-- hora, sem fluxo de aprovação obrigatório pra quem só quer um banco de
-- imagens simples).
-- ============================================================================

alter table business_assets add column if not exists folder_id uuid references business_asset_folders (id) on delete set null;
alter table business_assets add column if not exists tipo_ativo text not null default 'image' check (tipo_ativo in (
  'image', 'video', 'audio', 'document', 'font', 'logo', 'brand_reference', 'other'
));
alter table business_assets add column if not exists categoria text not null default 'outro' check (categoria in (
  'identidade_visual', 'produtos_servicos', 'pessoas_especialistas',
  'ambientes_operacao', 'campanhas_referencias', 'documentos_contexto', 'outro'
));
alter table business_assets add column if not exists descricao text;
alter table business_assets add column if not exists status text not null default 'aprovado' check (status in (
  'rascunho', 'aprovado', 'arquivado', 'rejeitado'
));
alter table business_assets add column if not exists motivo_status text;
alter table business_assets add column if not exists is_logo_principal boolean not null default false;
alter table business_assets add column if not exists favorito boolean not null default false;
alter table business_assets add column if not exists regras_uso jsonb not null default '{}'::jsonb;
alter table business_assets add column if not exists size_bytes bigint;
alter table business_assets add column if not exists created_by uuid references usuarios (id) on delete set null;
alter table business_assets add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_business_assets_folder_id on business_assets (folder_id);
create index if not exists idx_business_assets_categoria on business_assets (cliente_id, categoria);
create index if not exists idx_business_assets_status on business_assets (cliente_id, status);

-- ============================================================================
-- business_asset_usage — toda vez que um agente usa um ativo real numa
-- geração, fica registrado aqui (nunca "usei tal imagem" só na prosa do
-- summary). Escrita só via service_role, mesmo padrão de agent_runs/artifacts.
-- ============================================================================

create table if not exists business_asset_usage (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  asset_id uuid not null references business_assets (id) on delete cascade,
  mission_id uuid references missions (id) on delete set null,
  mission_step_id uuid references mission_steps (id) on delete set null,
  artifact_id uuid references artifacts (id) on delete set null,
  agente text not null,
  papel text not null check (papel in (
    'referencia', 'fonte', 'logo', 'template', 'fundo', 'produto', 'pessoa'
  )),
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_asset_usage_cliente_id on business_asset_usage (cliente_id);
create index if not exists idx_business_asset_usage_asset_id on business_asset_usage (asset_id);
create index if not exists idx_business_asset_usage_mission_id on business_asset_usage (mission_id);

alter table business_asset_usage enable row level security;

create policy "business_asset_usage: isolado por cliente" on business_asset_usage
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- brand_kits — logo oficial como ativo real do Drive (FK), não arquivo
-- solto. Os campos antigos (logo_principal_ref etc., texto livre) continuam
-- existindo por compatibilidade — os novos campos *_asset_id são a fonte de
-- verdade daqui pra frente, sempre apontando pra uma linha de business_assets
-- do mesmo cliente (nunca um path solto sem registro).
-- ============================================================================

alter table brand_kits add column if not exists logo_principal_asset_id uuid references business_assets (id) on delete set null;
alter table brand_kits add column if not exists logo_fundo_claro_asset_id uuid references business_assets (id) on delete set null;
alter table brand_kits add column if not exists logo_fundo_escuro_asset_id uuid references business_assets (id) on delete set null;
alter table brand_kits add column if not exists logo_monocromatica_asset_id uuid references business_assets (id) on delete set null;
alter table brand_kits add column if not exists simbolo_asset_id uuid references business_assets (id) on delete set null;
alter table brand_kits add column if not exists logo_area_protecao text;
alter table brand_kits add column if not exists logo_tamanho_minimo text;
alter table brand_kits add column if not exists logo_fundos_proibidos jsonb not null default '[]'::jsonb;
alter table brand_kits add column if not exists logo_usos_proibidos jsonb not null default '[]'::jsonb;
-- Qual variante de logo usar por formato de peça, ex: {"feed": "principal", "story": "fundo_claro", "avatar": "simbolo"}
alter table brand_kits add column if not exists logo_por_formato jsonb not null default '{}'::jsonb;
