-- Pipeline de artefatos (auditoria "VETOR — arquitetura da agência"): toda
-- etapa que promete uma entrega precisa de um artifact_id verificável — nunca
-- "completed" com só uma frase dizendo que algo foi criado. Ver
-- apps/agentes/src/agents/specialistRunner.ts e missions/orchestrator.ts.

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  mission_id uuid references missions (id) on delete cascade,
  mission_step_id uuid references mission_steps (id) on delete cascade,
  solicitacao_id uuid references solicitacoes (id) on delete set null,
  parent_artifact_id uuid references artifacts (id) on delete set null,
  type text not null check (type in (
    'image', 'video', 'copy', 'document', 'report', 'plan', 'campaign_snapshot'
  )),
  -- Texto livre (não enum fechado) — cobre os agentes atuais (design,
  -- videomaker, trafego, planejamento, conteudo) e os que vierem depois sem
  -- exigir migration nova a cada agente.
  department text not null,
  title text not null,
  description text,
  status text not null default 'ready' check (status in (
    'processing', 'ready', 'awaiting_approval', 'approved', 'rejected', 'failed', 'archived'
  )),
  storage_provider text,
  storage_path text,
  signed_url_expires_at timestamptz,
  mime_type text,
  file_size bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_artifacts_cliente_id on artifacts (cliente_id);
create index if not exists idx_artifacts_mission_id on artifacts (mission_id);
create index if not exists idx_artifacts_mission_step_id on artifacts (mission_step_id);
create index if not exists idx_artifacts_solicitacao_id on artifacts (solicitacao_id);
create index if not exists idx_artifacts_department on artifacts (cliente_id, department);

alter table artifacts enable row level security;

create policy "artifacts: isolado por cliente" on artifacts
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');

-- Escrita só via service_role (worker/orchestrator) — o cliente nunca cria
-- artefato direto, só recebe o que o Vetor de fato produziu/persistiu.

-- ============================================================================
-- Storage — arquivos reais de artefato (imagem/vídeo baixado do provedor
-- externo, quando aplicável). Path lógico:
-- {cliente_id}/{departamento}/{ano}/{mes}/{solicitacao_id}/{tipo}/{artifact_id}/arquivo
-- Bucket privado — toda entrega ao navegador usa URL assinada e temporária
-- (signed_url_expires_at), nunca expõe o bucket publicamente.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do nothing;

create policy "artifacts-storage: cliente le os proprios arquivos"
  on storage.objects for select
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = current_cliente_id()::text
  );
