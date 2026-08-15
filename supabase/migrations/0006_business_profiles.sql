-- business_profiles / brand_kits (aditivo) — docs/manus-jarvis-spec/docs/06-modelo-de-dados.md,
-- Fase 1 do plano de migracao (docs/09). Substitui aos poucos o jsonb solto
-- clientes.manual_marca, que continua existindo como fallback legado.

create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references clientes (id) on delete cascade,
  descricao text,
  ofertas jsonb not null default '[]'::jsonb,
  publico jsonb not null default '{}'::jsonb,
  tom text,
  restricoes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Versionado: nunca dar update no conteudo, sempre inserir nova linha.
-- is_atual marca a versao corrente; indice parcial unico garante so uma por cliente.
create table if not exists brand_kits (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  versao integer not null,
  cores jsonb not null default '{}'::jsonb,
  fontes jsonb not null default '{}'::jsonb,
  logo_refs jsonb not null default '[]'::jsonb,
  regras jsonb not null default '{}'::jsonb,
  is_atual boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cliente_id, versao)
);

create unique index if not exists idx_brand_kits_atual_por_cliente
  on brand_kits (cliente_id) where is_atual;

create index if not exists idx_business_profiles_cliente_id on business_profiles (cliente_id);
create index if not exists idx_brand_kits_cliente_id on brand_kits (cliente_id, versao desc);

alter table business_profiles enable row level security;
alter table brand_kits enable row level security;

create policy "business_profiles: isolado por cliente" on business_profiles
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_profiles: cliente cria o proprio" on business_profiles
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "business_profiles: cliente edita o proprio" on business_profiles
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "brand_kits: isolado por cliente" on brand_kits
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "brand_kits: cliente cria versao propria" on brand_kits
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Backfill best-effort a partir do jsonb legado, sem quebrar nada se o formato nao bater.
insert into business_profiles (cliente_id, descricao)
select id, nicho from clientes
where manual_marca is not null
on conflict (cliente_id) do nothing;

insert into brand_kits (cliente_id, versao, cores, is_atual)
select id, 1, coalesce(manual_marca -> 'cores', '{}'::jsonb), true
from clientes
where manual_marca is not null
on conflict (cliente_id, versao) do nothing;
