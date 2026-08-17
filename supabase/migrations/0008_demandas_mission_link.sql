-- Liga demandas legadas a uma missão quando o pedido vira um plano coordenado
-- pelo Vetor (usado na página /solicitacoes pra distinguir "convertida em
-- missão" de "ainda solta"). Nullable e aditivo — não afeta o fluxo de
-- WhatsApp/Secretário, que continua gravando demandas sem mission_id.
alter table demandas add column if not exists mission_id uuid references missions (id) on delete set null;
create index if not exists idx_demandas_mission_id on demandas (mission_id);
