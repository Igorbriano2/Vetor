-- Adiciona "voice_wake_word" como origem válida de conversas/solicitações —
-- a solicitação capturada pelo assistente de voz (wake word "vetor") usa o
-- mesmo pipeline de conversas/solicitações do painel, só com uma origem
-- distinta pra auditoria (nunca um agente/histórico paralelo). Idempotente:
-- drop+recreate da mesma constraint, sem alterar dado existente.

alter table conversas drop constraint if exists conversas_origem_check;
alter table conversas add constraint conversas_origem_check
  check (origem in ('painel_texto', 'painel_audio', 'whatsapp', 'evento', 'voice_wake_word'));

alter table solicitacoes drop constraint if exists solicitacoes_origem_check;
alter table solicitacoes add constraint solicitacoes_origem_check
  check (origem in ('painel_texto', 'painel_audio', 'whatsapp', 'evento', 'voice_wake_word'));
