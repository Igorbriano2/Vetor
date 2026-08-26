-- Design V2 (auditoria Gravyx — módulo "Performance") — o dono do produto
-- pediu explicitamente pra copiar o painel de Tráfego do Gravyx, que tem um
-- ranking real "Top 5 criativos por métrica" (CPC/CTR/ROAS). O sync atual
-- (metaAdsSync.ts) só chama /campaigns + /insights por campanha — nunca
-- existiu granularidade de anúncio/criativo no schema (confirmado: nenhuma
-- tabela ads/criativos em nenhuma migration anterior). Sem isso, um
-- ranking de "melhores criativos" seria só as campanhas de novo, não um
-- recurso novo de verdade. Tabela nova e necessária, aditiva, mesmo padrão
-- de RLS universal do resto da base.

create table if not exists criativos_trafego (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  campanha_id uuid references campanhas_trafego (id) on delete cascade,
  meta_ad_id text not null,
  nome text not null,
  thumbnail_url text,
  metricas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_criativos_trafego_meta_ad_id on criativos_trafego (meta_ad_id);
create index if not exists idx_criativos_trafego_cliente_id on criativos_trafego (cliente_id);
create index if not exists idx_criativos_trafego_campanha_id on criativos_trafego (campanha_id);

alter table criativos_trafego enable row level security;

create policy "criativos_trafego: isolado por cliente" on criativos_trafego
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "criativos_trafego: cliente cria os proprios" on criativos_trafego
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "criativos_trafego: cliente edita os proprios" on criativos_trafego
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "criativos_trafego: cliente apaga os proprios" on criativos_trafego
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
