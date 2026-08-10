-- Captura de leads da landing page (documento 02, secao "CTA final + formulario").
-- Insercao acontece via service_role no backend (API route), que ignora RLS
-- de proposito — nao existe policy de insert publica.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  tipo_negocio text not null,
  origem text not null default 'landing_page',
  criado_em timestamptz not null default now()
);

alter table leads enable row level security;

create policy "leads: apenas admin_vetor le" on leads
  for select using (current_papel() = 'admin_vetor');
