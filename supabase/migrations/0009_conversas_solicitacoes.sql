-- Persistência de conversa e solicitação multimodal (Fase 3 do plano de
-- funcionalização do VETOR). Aditivo: não remove nem altera `demandas`
-- (canal legado do WhatsApp continua gravando lá, sem mudança).
--
-- `conversas` agrupa mensagens (painel texto/áudio, WhatsApp, eventos) numa
-- thread persistente. `solicitacoes` é o pedido derivado de uma conversa,
-- com estado próprio e, quando confirmado, ligado a uma `missions` real.

create table if not exists conversas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  usuario_id uuid references usuarios (id) on delete set null,
  origem text not null check (origem in ('painel_texto', 'painel_audio', 'whatsapp', 'evento')),
  created_at timestamptz not null default now(),
  ultima_mensagem_em timestamptz not null default now()
);

create index if not exists idx_conversas_cliente on conversas (cliente_id, ultima_mensagem_em desc);

alter table conversas enable row level security;

create policy "conversas: isolado por cliente" on conversas
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create table if not exists solicitacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  conversa_id uuid references conversas (id) on delete set null,
  origem text not null check (origem in ('painel_texto', 'painel_audio', 'whatsapp', 'evento')),
  status text not null default 'received' check (status in (
    'received', 'transcribing', 'understanding', 'awaiting_context', 'planned',
    'confirmed', 'converted_to_mission', 'archived', 'failed'
  )),
  texto text,
  transcricao text,
  confianca_transcricao text check (confianca_transcricao in ('high', 'medium', 'low')),
  mission_id uuid references missions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_solicitacoes_cliente on solicitacoes (cliente_id, created_at desc);
create unique index if not exists idx_solicitacoes_mission_unica on solicitacoes (mission_id) where mission_id is not null;

alter table solicitacoes enable row level security;

create policy "solicitacoes: isolado por cliente" on solicitacoes
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

alter table mensagens_plataforma add column if not exists conversa_id uuid references conversas (id) on delete set null;
alter table mensagens_plataforma add column if not exists transcricao text;
alter table mensagens_plataforma add column if not exists confianca_transcricao text check (confianca_transcricao in ('high', 'medium', 'low'));

create index if not exists idx_mensagens_plataforma_conversa on mensagens_plataforma (conversa_id);
