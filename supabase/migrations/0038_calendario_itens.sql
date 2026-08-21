-- Fase 5 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md, decisão #1)
-- — antes desta rodada o "calendário editorial" era JSON solto dentro de
-- artifacts.metadata.calendario (sem tabela dedicada, sem schema
-- validado, sem filtro/índice consultável via SQL — confirmado na
-- Fase 0). Os 13 campos estruturados pedidos + múltiplos status são
-- naturalmente relacionais, não mais um blob jsonb — daí a tabela nova.
-- artifacts.metadata.calendario continua existindo (documentos de
-- planejamento gerados pelo Vetor continuam sendo artifacts reais), só
-- deixa de ser a fonte dos itens navegáveis do calendário.

create table if not exists calendario_itens (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  titulo text not null,
  data_publicacao date not null,
  canal text,
  formato text,
  objetivo text,
  editoria text,
  persona text,
  briefing text,
  copy text,
  asset_id uuid references business_assets (id) on delete set null,
  referencia_id uuid references reference_library_items (id) on delete set null,
  status text not null default 'ideia' check (status in (
    'ideia', 'briefing', 'em_producao', 'aguardando_aprovacao', 'aprovado', 'programado', 'publicado', 'arquivado'
  )),
  data_entrega date,
  data_aprovacao date,
  mission_id uuid references missions (id) on delete set null,
  agendado_para timestamptz,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendario_itens_cliente_id on calendario_itens (cliente_id);
create index if not exists idx_calendario_itens_data_publicacao on calendario_itens (cliente_id, data_publicacao);

alter table calendario_itens enable row level security;

create policy "calendario_itens: isolado por cliente" on calendario_itens
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "calendario_itens: cliente cria os proprios" on calendario_itens
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "calendario_itens: cliente edita os proprios" on calendario_itens
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "calendario_itens: cliente apaga os proprios" on calendario_itens
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
