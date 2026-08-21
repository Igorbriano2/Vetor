-- Fase 3 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — os perfis de
-- estilo (reference_image_profiles/reference_video_profiles) já existem e já
-- são análises reais via Claude vision, mas ficam em campos técnicos
-- separados (composição/paleta/densidade/...) nunca resumidos numa frase
-- simples pro cliente final. `resumo_simples` é gerado pelo MESMO Claude
-- que já analisa a peça (não é uma heurística de texto sobre campos livres,
-- que seria frágil) — nullable porque análises já existentes não são
-- reprocessadas retroativamente.

alter table reference_image_profiles add column if not exists resumo_simples text;
alter table reference_video_profiles add column if not exists resumo_simples text;
