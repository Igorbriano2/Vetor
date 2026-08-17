-- Necessário pro upsert de sincronização real do Meta Ads (onConflict:
-- meta_campaign_id) — sem isso, cada sync criaria linha duplicada em vez de
-- atualizar a campanha existente. Ver apps/agentes/src/connections/metaAdsSync.ts.
create unique index if not exists idx_campanhas_trafego_meta_campaign_id
  on campanhas_trafego (meta_campaign_id)
  where meta_campaign_id is not null;
