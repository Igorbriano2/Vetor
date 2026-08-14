-- Canal do Vetor dentro da plataforma (painel) — separado do WhatsApp porque a
-- identidade aqui vem da sessao autenticada (cliente_id), nao de um numero de
-- telefone. Ver docs/09 e o pedido de "Vetor conversar dentro do painel".

create table if not exists mensagens_plataforma (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_plataforma_cliente on mensagens_plataforma (cliente_id, created_at);

alter table mensagens_plataforma enable row level security;

create policy "mensagens_plataforma: isolado por cliente" on mensagens_plataforma
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
