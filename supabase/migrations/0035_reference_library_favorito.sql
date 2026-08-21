-- Fase 9 do Design V2 (docs/DESIGN-V2-PHASE-9-10-REPORT.md) — sustenta a
-- coleção "Salvas" em Referências com dado real, mesmo padrão já usado em
-- business_assets.favorito (migration 0018) — nunca um rótulo de UI sem
-- campo real por trás.

alter table reference_library_items add column if not exists favorito boolean not null default false;

create index if not exists idx_reference_library_items_favorito
  on reference_library_items (cliente_id, favorito) where favorito = true;
