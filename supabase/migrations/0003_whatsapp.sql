-- Suporte ao Agente Secretario (docs/03, docs/06 comando 1.3).
-- whatsapp_numero identifica um cliente existente pelo numero que escreve.
-- mensagens_whatsapp guarda o historico bruto da conversa, usado como contexto
-- pelo agente a cada nova mensagem.

alter table clientes add column if not exists whatsapp_numero text unique;

create table if not exists mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  cliente_id uuid references clientes (id) on delete set null,
  direcao text not null check (direcao in ('entrada', 'saida')),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_whatsapp_numero on mensagens_whatsapp (numero, created_at);

alter table mensagens_whatsapp enable row level security;

create policy "mensagens_whatsapp: isolado por cliente" on mensagens_whatsapp
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
