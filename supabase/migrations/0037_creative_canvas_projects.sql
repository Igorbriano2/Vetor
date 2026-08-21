-- Fase 3 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md) — Creative
-- Canvas node-based. Não existe nada equivalente hoje (confirmado na
-- Fase 0: zero dependência de biblioteca de grafo, MissionCanvas.tsx é só
-- leitura). graph_json guarda nodes+edges do React Flow inteiros — mesmo
-- padrão já usado em design_projects.canvas_json (schema-less jsonb pra
-- estrutura que muda com frequência, sem migration por campo novo).
-- Modo avançado opcional: nunca obrigatório pro fluxo principal (chat +
-- receitas), só uma visualização/edição alternativa da mesma missão.

create table if not exists creative_canvas_projects (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  mission_id uuid references missions (id) on delete set null,
  title text not null,
  graph_json jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'em_producao', 'aguardando_aprovacao', 'aprovado', 'arquivado')),
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_creative_canvas_projects_cliente_id on creative_canvas_projects (cliente_id);

alter table creative_canvas_projects enable row level security;

-- Mesmo padrão de RLS de toda a base (confirmado 100% consistente na
-- Fase 0) — cliente só vê/edita o próprio workspace, admin_vetor vê tudo.
create policy "creative_canvas_projects: isolado por cliente" on creative_canvas_projects
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "creative_canvas_projects: cliente cria os proprios" on creative_canvas_projects
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "creative_canvas_projects: cliente edita os proprios" on creative_canvas_projects
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "creative_canvas_projects: cliente apaga os proprios" on creative_canvas_projects
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
