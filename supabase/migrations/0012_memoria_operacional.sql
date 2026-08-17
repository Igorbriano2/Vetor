-- Fase 7 — memória operacional mínima. Complementa business_profiles/brand_kits
-- (que já guardam o "perfil estático" do negócio) com uma trilha de fatos,
-- decisões, hipóteses e resultados ao longo do tempo, sempre com origem e
-- confiança — pra o Vetor nunca tratar uma inferência antiga como fato.

create table if not exists memoria_operacional (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo text not null check (tipo in (
    'fato', 'preferencia', 'decisao', 'hipotese', 'resultado_experimento', 'feedback', 'restricao'
  )),
  conteudo text not null,
  origem text not null default 'vetor',
  confianca text not null default 'medium' check (confianca in ('high', 'medium', 'low')),
  mission_id uuid references missions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_memoria_operacional_cliente on memoria_operacional (cliente_id, created_at desc);

alter table memoria_operacional enable row level security;

create policy "memoria_operacional: isolado por cliente" on memoria_operacional
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
