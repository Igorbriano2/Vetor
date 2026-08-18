-- Design profissional (Parte 1 da evolução de Design/Vídeo) — projeto de
-- canvas versionado. Diferente de `artifacts` (que é o PNG/entrega final,
-- somente leitura pro cliente, escrito só pelo agente): design_projects É
-- editado pelo cliente de verdade no navegador (Fabric.js), então segue o
-- padrão de CRUD-por-dono de business_assets, não o padrão read-only de
-- artifacts. Cada versão é sua própria linha (parent_design_project_id +
-- version), igual ao padrão já usado em artifacts.parent_artifact_id —
-- nunca sobrescreve a versão anterior, "criar versão" é sempre um insert
-- novo.

create table if not exists design_projects (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  mission_id uuid references missions (id) on delete cascade,
  mission_step_id uuid references mission_steps (id) on delete cascade,
  solicitacao_id uuid references solicitacoes (id) on delete set null,
  parent_design_project_id uuid references design_projects (id) on delete set null,
  artifact_id uuid references artifacts (id) on delete set null,
  title text not null,
  width integer not null,
  height integer not null,
  canvas_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  status text not null default 'draft' check (status in (
    'draft', 'awaiting_approval', 'approved', 'archived'
  )),
  thumbnail_url text,
  -- ids reais dos ativos do Drive usados na composição (produto/pessoa/
  -- referência/logo) — mesmo raciocínio de business_asset_usage, mas aqui
  -- na granularidade do projeto editável, não só do PNG exportado.
  source_asset_ids uuid[] not null default '{}',
  logo_asset_id uuid references business_assets (id) on delete set null,
  -- Referências aprovadas do mesmo tenant que orientaram esta composição
  -- (Parte 1, "aprende com criações aprovadas" — nunca cópia literal).
  reference_asset_ids uuid[] not null default '{}',
  brand_validation jsonb,
  design_brief text,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_design_projects_cliente_id on design_projects (cliente_id);
create index if not exists idx_design_projects_mission_id on design_projects (mission_id);
create index if not exists idx_design_projects_parent on design_projects (parent_design_project_id);
create index if not exists idx_design_projects_artifact on design_projects (artifact_id);

alter table design_projects enable row level security;

create policy "design_projects: isolado por cliente" on design_projects
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "design_projects: cliente cria os proprios" on design_projects
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "design_projects: cliente edita os proprios" on design_projects
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor')
  with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Nunca delete físico — versão vira "archived" (status), preserva
-- histórico de edição/aprovação como o resto do produto já faz.
