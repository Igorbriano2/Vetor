-- Custo estimado por agent_run (FASE 1 do plano de reconciliação,
-- docs/STATUS-REAL-ATUAL.md item 15) — custo_estimado_centavos já existia
-- desde 0004_missions.sql mas nunca era preenchido. Quando o cálculo não é
-- possível (sem usage do provider, modelo desconhecido, usage inválido), o
-- código grava null em custo_estimado_centavos + o motivo aqui — nunca um
-- número inventado, e nunca um "sem motivo" silencioso.

alter table agent_runs add column if not exists custo_motivo_ausencia text;
