-- ReferenceImageProfile (Fase 2 do reset de produto, docs/PRODUCT-RESET-AUDIT.md)
-- — generaliza reference_video_profiles (migration 0025) pra referências
-- ESTÁTICAS (imagem): "Ver análise visual" precisa funcionar pra imagem, não
-- só vídeo. Mesma postura fail-closed: cada campo vem de leitura real via
-- Claude vision sobre a imagem real, nunca inventado; sem sinal mecânico
-- (ffmpeg) aqui porque não existe corte/áudio numa imagem estática. Só
-- referências vindas de um arquivo do Drive (source_type='upload') podem
-- ser analisadas — nunca uma URL externa (proibido baixar/raspar conteúdo
-- de fora, mesma regra já aplicada em referenceVideoAnalysis.ts).

create table if not exists reference_image_profiles (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  source_asset_id uuid not null references business_assets (id) on delete cascade,
  reference_library_item_id uuid references reference_library_items (id) on delete set null,
  -- Campos pedidos explicitamente pelo prompt mestre do reset de produto:
  -- composição, grid, hierarquia, paleta, ritmo, densidade, tipografia
  -- descritiva e tratamento de imagem — todos texto livre em português,
  -- descrição objetiva do que é visível, nunca um julgamento de qualidade.
  composicao text not null,
  grid text not null,
  hierarquia text not null,
  paleta text not null,
  ritmo_visual text not null,
  densidade text not null,
  tipografia_descricao text not null,
  tratamento_imagem text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reference_image_profiles_cliente_id on reference_image_profiles (cliente_id);
create index if not exists idx_reference_image_profiles_source_asset on reference_image_profiles (source_asset_id);
create index if not exists idx_reference_image_profiles_library_item on reference_image_profiles (reference_library_item_id);

alter table reference_image_profiles enable row level security;

create policy "reference_image_profiles: isolado por cliente" on reference_image_profiles
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "reference_image_profiles: cliente cria os proprios" on reference_image_profiles
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Análise é imutável, mesmo padrão de reference_video_profiles: sem policy
-- de update/delete (refazer a análise cria uma linha nova).
