-- Biblioteca de Referências (Fase 1 do upgrade inspirado no Gravyx, ver
-- docs/GRAVYX-UPGRADE-AUDIT.md) — catálogo de referências visuais/de estilo
-- que o cliente pode reunir ANTES de pedir uma peça, distinto de:
--   - business_assets: o que o cliente FORNECE como matéria-prima real
--     (logo, foto de produto/pessoa/ambiente) pra ser incorporado literalmente
--     numa peça (image-to-image).
--   - design_projects.reference_asset_ids / reference_video_profiles: peças
--     do PRÓPRIO tenant já aprovadas, ou perfil de estilo já extraído de um
--     vídeo do Drive.
-- reference_library_items é o CATÁLOGO de origem (fonte, direitos, tags) de
-- onde uma referência entra no sistema — upload do cliente, URL externa
-- (nunca scraping, só o link que o próprio cliente colou), ou curada pelo
-- time Vetor (cliente_id nulo, visível a todos os tenants). A extração de
-- PERFIL de estilo a partir de um item daqui (Fase 3, generalização de
-- referenceVideoAnalysis.ts) é trabalho de uma rodada futura — esta
-- migration só cria o catálogo, nunca decide isso.

create table if not exists reference_library_items (
  id uuid primary key default gen_random_uuid(),
  -- Nulo = item curado pelo time Vetor, visível a todos os tenants (ver
  -- policy de select abaixo). Só admin_vetor consegue gravar cliente_id
  -- nulo — o mesmo padrão "cliente_id = current_cliente_id() or
  -- current_papel() = 'admin_vetor'" usado em toda a base já garante isso
  -- (um cliente comum nunca consegue satisfazer a igualdade com null).
  cliente_id uuid references clientes (id) on delete cascade,
  source_type text not null check (source_type in ('upload', 'external_url', 'curated')),
  -- Upload real reaproveita o Drive (business_assets) em vez de duplicar
  -- storage/pipeline de arquivo — nunca um segundo bucket pra mesma coisa.
  asset_id uuid references business_assets (id) on delete set null,
  -- Só o link que o cliente colou — nunca populado por scraping automático
  -- (proibido pelo prompt mestre do upgrade).
  external_url text,
  title text not null,
  description text,
  tags text[] not null default '{}',
  -- Mesmo vocabulário livre de artifacts.department (design/videomaker/
  -- trafego/planejamento/conteudo) — nulo quando a referência ainda não
  -- foi associada a um departamento específico.
  department text,
  -- Nota de direitos de uso em texto livre (ex: "uso interno só como
  -- inspiração", "licenciado", "próprio cliente") — nunca assumido
  -- automaticamente, sempre o que foi informado por quem cadastrou.
  direitos_uso text,
  status text not null default 'ativo' check (status in ('ativo', 'arquivado')),
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sempre tem uma origem real de conteúdo — nunca uma linha vazia sem
  -- arquivo nem link.
  constraint reference_library_items_tem_origem check (asset_id is not null or external_url is not null)
);

create index if not exists idx_reference_library_items_cliente_id on reference_library_items (cliente_id);
create index if not exists idx_reference_library_items_status on reference_library_items (status);
create index if not exists idx_reference_library_items_asset_id on reference_library_items (asset_id);

alter table reference_library_items enable row level security;

-- Único desvio proposital do padrão "cliente_id = current_cliente_id() or
-- admin_vetor" do resto da base: aqui um cliente_id nulo (curado) também é
-- visível — é o ponto central desta tabela (catálogo compartilhado).
create policy "reference_library_items: proprio, curado, ou admin" on reference_library_items
  for select using (
    cliente_id = current_cliente_id() or cliente_id is null or current_papel() = 'admin_vetor'
  );

create policy "reference_library_items: cliente cria as proprias" on reference_library_items
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "reference_library_items: cliente edita as proprias" on reference_library_items
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "reference_library_items: cliente apaga as proprias" on reference_library_items
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- Coleções — agrupamento nomeado de referências dentro do mesmo tenant (ex:
-- "Inspiração Campanha Setembro"). Sempre privadas ao cliente, mesmo quando
-- reúnem itens curados (o agrupamento em si é do tenant, os itens dentro
-- podem ser compartilhados).
-- ============================================================================

create table if not exists reference_collections (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome text not null,
  descricao text,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reference_collections_cliente_id on reference_collections (cliente_id);

alter table reference_collections enable row level security;

create policy "reference_collections: isolado por cliente" on reference_collections
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "reference_collections: cliente cria as proprias" on reference_collections
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "reference_collections: cliente edita as proprias" on reference_collections
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "reference_collections: cliente apaga as proprias" on reference_collections
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create table if not exists reference_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references reference_collections (id) on delete cascade,
  reference_library_item_id uuid not null references reference_library_items (id) on delete cascade,
  -- Denormalizado (mesmo padrão já usado em mission_steps/agent_runs/
  -- approvals em relação a missions) — mantém a policy de RLS uma
  -- comparação direta, nunca um join/subquery pra decidir acesso.
  cliente_id uuid not null references clientes (id) on delete cascade,
  added_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (collection_id, reference_library_item_id)
);

create index if not exists idx_reference_collection_items_collection_id on reference_collection_items (collection_id);
create index if not exists idx_reference_collection_items_cliente_id on reference_collection_items (cliente_id);

alter table reference_collection_items enable row level security;

create policy "reference_collection_items: isolado por cliente" on reference_collection_items
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "reference_collection_items: cliente adiciona nas proprias" on reference_collection_items
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "reference_collection_items: cliente remove das proprias" on reference_collection_items
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
