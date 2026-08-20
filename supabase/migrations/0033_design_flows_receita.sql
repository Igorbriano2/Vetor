-- Templates como receitas de agência (Fase 3 do reset de produto, ver
-- docs/PRODUCT-RESET-AUDIT.md) — design_flows (migration 0031) hoje só
-- guarda `tarefa_template` (um texto pra colar no chat). O prompt mestre
-- pede um template completo: thumbnail, objetivo, setor recomendado,
-- formato, exemplo de resultado, campos guiados, assets necessários,
-- referência opcional, número de variações, etapas de execução e se
-- precisa de aprovação. Em vez de uma coluna por campo (rígido, exige
-- migration nova a cada ajuste), um jsonb aditivo — mesmo padrão já usado
-- em missions.contexto_snapshot/artifacts.metadata nesta base. `tarefa_template`
-- continua existindo (nunca removida) pra qualquer consumidor antigo.
-- Não é uma tabela nova nem muda RLS — só estende a existente.

alter table design_flows
  add column if not exists thumbnail_url text,
  add column if not exists receita jsonb not null default '{}'::jsonb;
