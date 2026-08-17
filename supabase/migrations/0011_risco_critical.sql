-- Fase 6 — gateway de ferramentas: ferramentas "critical" (ex:
-- ajustar_orcamento_trafego, criar_campanha_trafego) agora existem como nível
-- de risco próprio, distinto de "high". mission_steps e approvals precisam
-- aceitar esse valor.

alter table mission_steps drop constraint if exists mission_steps_risco_check;
alter table mission_steps add constraint mission_steps_risco_check check (risco in ('low', 'medium', 'high', 'critical'));

alter table approvals drop constraint if exists approvals_risco_check;
alter table approvals add constraint approvals_risco_check check (risco in ('medium', 'high', 'critical'));
