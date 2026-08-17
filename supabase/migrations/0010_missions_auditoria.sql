-- Fase 5 — auditoria e retomada de missão: hash/snapshot do plano confirmado,
-- e trilha de eventos por transição de estado. Aditivo sobre 0004_missions.sql.

alter table missions add column if not exists plan_hash text;
alter table missions add column if not exists plan_version integer not null default 1;
alter table missions add column if not exists contexto_snapshot jsonb;
alter table missions add column if not exists confirmado_por uuid references usuarios (id) on delete set null;
alter table missions add column if not exists confirmado_em timestamptz;
alter table missions add column if not exists orcamento_confirmado_centavos integer;
alter table missions add column if not exists prazo_confirmado timestamptz;

-- Novos estados de missão (replanning, quality_review, awaiting_evidence,
-- completed_with_caveats — ver apps/agentes/src/missions/stateMachine.ts).
alter table missions drop constraint if exists missions_status_check;
alter table missions add constraint missions_status_check check (status in (
  'draft', 'understanding', 'awaiting_clarification', 'planned', 'awaiting_approval',
  'queued', 'running', 'awaiting_evidence', 'quality_review', 'replanning',
  'blocked', 'completed', 'completed_with_caveats', 'failed', 'cancelled', 'archived'
));

create table if not exists mission_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  mission_step_id uuid references mission_steps (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  ator_tipo text not null check (ator_tipo in ('sistema', 'cliente', 'usuario')),
  ator_id uuid references usuarios (id) on delete set null,
  estado_anterior text,
  estado_novo text not null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mission_events_mission on mission_events (mission_id, created_at);
create index if not exists idx_mission_events_cliente on mission_events (cliente_id);

alter table mission_events enable row level security;

create policy "mission_events: isolado por cliente" on mission_events
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
