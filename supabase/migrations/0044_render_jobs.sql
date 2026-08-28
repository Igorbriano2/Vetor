-- Achado ao vivo (teste real de finalização de vídeo multi-clipe, 2026-08-28):
-- POST /render/final-multi-clip segurava a requisição HTTP aberta até o
-- ffmpeg terminar (download dos clipes + concat + libx264 + legendas
-- queimadas) — em produção (DigitalOcean App Platform, timeout fixo de
-- proxy reverso de ~60s) isso derrubava a requisição com 503/504
-- (upstream_reset_before_response_started) antes do render de 12s/2-clipes
-- terminar, mesmo com o próprio /health respondendo instantâneo. Não é bug
-- no ffmpeg/args (39/39 testes unitários passavam) — é a arquitetura
-- síncrona não caber no teto de tempo da plataforma.
--
-- render_jobs vira o registro do job assíncrono: a rota cria a linha e
-- responde na hora com o jobId, o processamento real roda em background no
-- mesmo processo Express, e apps/agentes faz polling em vez de segurar uma
-- única requisição. Só apps/render (service role) toca essa tabela — nunca
-- exposta a cliente/painel diretamente, por isso RLS habilitado sem
-- nenhuma policy pra anon/authenticated (service role sempre contorna RLS).
create table if not exists render_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_render_jobs_status on render_jobs (status);

alter table render_jobs enable row level security;
