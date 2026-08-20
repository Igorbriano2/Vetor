-- Templates reutilizáveis (Fase 4 do upgrade Gravyx, Rodada E, ver
-- docs/GRAVYX-UPGRADE-AUDIT.md) — o cliente salva um pedido que funcionou
-- bem ("Peça de feed com nossa identidade, headline sobre a promoção da
-- semana, CTA peça já") e reusa depois sem reescrever do zero. Deliberadamente
-- NÃO é um caminho paralelo de geração: aplicar um template só prepara o
-- texto no comando do chat (a mesma porta de entrada de sempre) — o
-- especialista de verdade (Design/Vídeo/etc.) continua decidindo o que fazer,
-- nunca um "modo automático" que pula o entendimento do Vetor. Nome da
-- tabela mantido conforme o prompt mestre do upgrade ("design_flows"), mas
-- department nulo cobre qualquer departamento, não só Design.

create table if not exists design_flows (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome text not null,
  descricao text,
  -- Vocabulário livre igual artifacts.department — nulo quando o template
  -- não é específico de um departamento.
  department text,
  -- O texto de verdade que vira o comando no chat quando o cliente aplica
  -- o template — nunca um JSON de configuração interna, sempre pedido em
  -- linguagem natural, exatamente como o cliente digitaria.
  tarefa_template text not null,
  tags text[] not null default '{}',
  status text not null default 'ativo' check (status in ('ativo', 'arquivado')),
  vezes_usado integer not null default 0,
  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_design_flows_cliente_id on design_flows (cliente_id);
create index if not exists idx_design_flows_status on design_flows (status);

alter table design_flows enable row level security;

create policy "design_flows: isolado por cliente" on design_flows
  for select using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "design_flows: cliente cria os proprios" on design_flows
  for insert with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "design_flows: cliente edita os proprios" on design_flows
  for update using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
create policy "design_flows: cliente apaga os proprios" on design_flows
  for delete using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
