-- Continuação do escopo declarado fora da rodada anterior: banco de imagens
-- pesquisável, upload de origem (Videomaker/Design), e análise diária de
-- tráfego persistida (nunca "atualizada" sem registrar quando de verdade).

-- ============================================================================
-- business_assets — banco de imagens do Negócio: pastas, tags, busca. Os
-- arquivos em si ficam no bucket já existente 'brand-assets' (0013); aqui só
-- o metadado pesquisável. Distinto de `artifacts` (que é o que o Vetor
-- PRODUZ) — isto é o que o cliente FORNECE como referência.
-- ============================================================================

create table if not exists business_assets (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  storage_path text not null,
  nome text not null,
  pasta text not null default 'geral',
  tags jsonb not null default '[]'::jsonb,
  mime_type text,
  width integer,
  height integer,
  origem text not null default 'upload_cliente' check (origem in ('upload_cliente', 'gerado_agente')),
  created_at timestamptz not null default now()
);

create index if not exists idx_business_assets_cliente_id on business_assets (cliente_id);
create index if not exists idx_business_assets_pasta on business_assets (cliente_id, pasta);

alter table business_assets enable row level security;

create policy "business_assets: isolado por cliente" on business_assets
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_assets: cliente cria os proprios" on business_assets
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_assets: cliente edita os proprios" on business_assets
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_assets: cliente apaga os proprios" on business_assets
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- ============================================================================
-- Bucket "uploads" — origem enviada pelo cliente pro Vetor processar
-- (imagem de referência pro Design, vídeo bruto pro Videomaker). Privado,
-- path {cliente_id}/{arquivo}, mesmo padrão de isolamento das outras tabelas.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "uploads: cliente le os proprios arquivos"
  on storage.objects for select
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = current_cliente_id()::text);

create policy "uploads: cliente envia nos proprios arquivos"
  on storage.objects for insert
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = current_cliente_id()::text);

-- ============================================================================
-- trafego_analises — análise diária persistida (Tráfego → Dashboard). Nunca
-- mostrar "atualizado" sem isto: created_at É o horário da última sincronização.
-- ============================================================================

create table if not exists trafego_analises (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  data date not null default current_date,
  metricas_usadas jsonb not null default '{}'::jsonb,
  diagnostico text,
  oportunidades jsonb not null default '[]'::jsonb,
  riscos jsonb not null default '[]'::jsonb,
  recomendacoes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_trafego_analises_cliente_id on trafego_analises (cliente_id, created_at desc);

alter table trafego_analises enable row level security;

create policy "trafego_analises: isolado por cliente" on trafego_analises
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Sincronização real de campanhas precisa saber o ad account e a página
-- vinculados — já vem de connections (external_account_id), sem tabela nova.
