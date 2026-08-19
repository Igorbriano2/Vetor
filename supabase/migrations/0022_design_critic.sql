-- DesignCritic (Parte 1, critério de aceite) — avaliação estruturada da
-- peça gerada contra o checklist de qualidade (composição/hierarquia/
-- contraste/legibilidade mobile/tipografia/proporção/alinhamento/respiro
-- visual/CTA/uso da logo/BrandKit/adequação ao canal/coerência com o
-- pedido) ANTES de marcar a etapa como concluída. Guardado junto do
-- design_project (não do artifact) porque é avaliação da CAMADA EDITÁVEL,
-- reavaliável a cada nova versão.

alter table design_projects add column if not exists design_critic jsonb;
