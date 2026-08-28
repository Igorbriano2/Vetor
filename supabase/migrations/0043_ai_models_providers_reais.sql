-- ============================================================================
-- ai_models — achado ao vivo testando o ImageAdapter real: generation_jobs.
-- model_id tem FK pra ai_models(id), mas o catálogo de cada
-- AIProviderAdapter (apps/agentes/src/ai-providers/*Adapter.ts) é definido
-- em CÓDIGO, não no banco — um provider real novo (Fish Audio, ImageAdapter)
-- passa a existir no roteamento sem UMA LINHA correspondente aqui, e o
-- INSERT em generation_jobs falha por violação de FK depois da geração real
-- já ter acontecido (o pior caso: gastou a chamada paga e perdeu o registro).
-- Até ai_models ser gerado a partir do catálogo de código (trabalho futuro,
-- ver docs/arquitetura-suite-ia.md seção 3.1), todo AIModel novo com status
-- "featured"/"available" precisa de uma linha gêmea aqui — mesmo id,
-- provider_id, kind, capabilities.
-- ============================================================================

insert into ai_models (id, cliente_id, provider_id, provider_model_id, kind, label, description, capabilities, cost_credits, avg_latency_ms, status)
values
  (
    'fishaudio-voz-padrao', null, 'fishaudio', 's2.1-pro', 'voice', 'Voz natural (Fish Audio)',
    'Locução realista em português — provider real, não é pré-visualização.',
    '{"audio": true}'::jsonb, 3, 6000, 'featured'
  ),
  (
    'imagem-real-padrao', null, 'vetor-imagem', 'auto', 'image', 'Geração real (OpenAI / Gemini)',
    'Gera a peça de verdade — mesmo gateway usado pelo agente de Design, sem passar por aprovação de missão.',
    '{"referenceImages": true, "multiReference": true, "negativePrompt": false, "maxResolution": "2K"}'::jsonb, 4, 12000, 'featured'
  )
on conflict (id) do update set
  provider_id = excluded.provider_id,
  provider_model_id = excluded.provider_model_id,
  kind = excluded.kind,
  label = excluded.label,
  description = excluded.description,
  capabilities = excluded.capabilities,
  cost_credits = excluded.cost_credits,
  avg_latency_ms = excluded.avg_latency_ms,
  status = excluded.status,
  updated_at = now();
