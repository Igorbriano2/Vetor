-- Schema de missoes (aditivo) — docs/manus-jarvis-spec/docs/06-modelo-de-dados.md,
-- adaptado aos nomes ja usados neste projeto (cliente_id no lugar de organization_id).
-- Nao substitui demandas/entregas ainda — coexistem ate o Mission Orchestrator
-- (docs/09-plano-de-migracao-jarvis.md, Fase 2) estar pronto.

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  titulo text not null,
  objetivo text not null,
  status text not null default 'draft' check (status in (
    'draft', 'understanding', 'awaiting_clarification', 'planned', 'awaiting_approval',
    'queued', 'running', 'blocked', 'completed', 'failed', 'cancelled', 'archived'
  )),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  orcamento_centavos integer,
  prazo timestamptz,
  hipotese text,
  criterio_sucesso jsonb not null default '[]'::jsonb,
  criado_por uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  agente text not null,
  tarefa text not null,
  depende_de uuid[] not null default '{}'::uuid[],
  ferramentas jsonb not null default '[]'::jsonb,
  risco text not null default 'low' check (risco in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in (
    'pending', 'ready', 'running', 'awaiting_approval', 'completed', 'blocked', 'failed',
    'skipped', 'cancelled'
  )),
  resultado jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  mission_step_id uuid not null references mission_steps (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  agente text not null,
  modelo text,
  prompt_version text,
  tokens_entrada integer,
  tokens_saida integer,
  custo_estimado_centavos integer,
  resultado jsonb,
  erro text,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  mission_step_id uuid references mission_steps (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  acao text not null,
  payload jsonb not null default '{}'::jsonb,
  risco text not null check (risco in ('medium', 'high')),
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'rejected', 'edited', 'expired', 'cancelled'
  )),
  decidido_por uuid references usuarios (id) on delete set null,
  decidido_em timestamptz,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_missions_cliente_status on missions (cliente_id, status, created_at);
create index if not exists idx_mission_steps_mission_id on mission_steps (mission_id);
create index if not exists idx_mission_steps_cliente_id on mission_steps (cliente_id);
create index if not exists idx_agent_runs_mission_step_id on agent_runs (mission_step_id);
create index if not exists idx_agent_runs_cliente_id on agent_runs (cliente_id);
create index if not exists idx_approvals_mission_id on approvals (mission_id);
create index if not exists idx_approvals_cliente_status on approvals (cliente_id, status);

alter table missions enable row level security;
alter table mission_steps enable row level security;
alter table agent_runs enable row level security;
alter table approvals enable row level security;

create policy "missions: isolado por cliente" on missions
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "mission_steps: isolado por cliente" on mission_steps
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "agent_runs: isolado por cliente" on agent_runs
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "approvals: isolado por cliente" on approvals
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

create policy "approvals: cliente decide as proprias" on approvals
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
