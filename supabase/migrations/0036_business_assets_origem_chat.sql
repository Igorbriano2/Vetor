-- Fase 2 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md, decisão #2)
-- — anexos enviados pelo chat reaproveitam business_assets (mesmo bucket
-- brand-assets, mesmo fluxo do Drive) em vez de um segundo sistema de
-- storage paralelo. origem_chat só marca a proveniência (nunca aparece
-- como um tipo de dado diferente), pra distinguir no futuro um upload
-- feito no chat de um upload feito no Banco de imagens/Drive, sem duplicar
-- a tabela nem criar um caminho de storage novo.

alter table business_assets add column if not exists origem_chat boolean not null default false;
