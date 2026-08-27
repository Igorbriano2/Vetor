-- Achado ao vivo pré-demo: sincronizarTrafego() upserta campanhas_trafego
-- com `onConflict: "meta_campaign_id"` (PostgREST gera `ON CONFLICT
-- (meta_campaign_id) DO UPDATE...`, sem WHERE nenhum). O índice único
-- existente (migration 0017/0018, não versionada separadamente) é PARCIAL
-- (`WHERE meta_campaign_id IS NOT NULL`) — o inferenciador de ON CONFLICT
-- do Postgres só casa com um índice parcial se o predicado for repetido
-- explicitamente no próprio ON CONFLICT, o que o cliente do Supabase não
-- faz. Resultado real: TODA sincronização de tráfego falhava ao gravar
-- CADA campanha com "no unique or exclusion constraint matching the ON
-- CONFLICT specification" — erro real do Postgres, mas o código do agente
-- só fazia `if (!error) sincronizadas++`, nunca logava nem lançava, então
-- a falha era 100% silenciosa (confirmado: trafego_analises acumulava
-- diagnóstico real com números reais da Graph API, mas campanhas_trafego
-- ficava sempre vazia).
--
-- O predicado parcial nunca foi necessário pra começo de conversa: um
-- índice único comum já trata múltiplos NULLs como não-conflitantes (regra
-- padrão do Postgres), então trocar pro índice não-parcial preserva
-- exatamente o mesmo comportamento pra campanhas sem meta_campaign_id
-- (criadas manualmente, se algum dia existirem) e corrige o ON CONFLICT.

drop index if exists idx_campanhas_trafego_meta_campaign_id;
create unique index if not exists idx_campanhas_trafego_meta_campaign_id
  on campanhas_trafego (meta_campaign_id);
