-- Fase 3 do upgrade Gravyx (Rodada C, ver docs/GRAVYX-UPGRADE-AUDIT.md seção
-- "Riscos") — liga reference_video_profiles (já existente, migration 0025) à
-- Biblioteca de Referências nova (migration 0029) SEM quebrar o fluxo já
-- provado em produção: source_asset_id continua obrigatório e é sempre a
-- fonte real usada na análise (ffmpeg/vision rodam sobre o asset, nunca
-- sobre o item de catálogo). reference_library_item_id é só um vínculo
-- opcional, aditivo — populado quando a análise partiu de um item já
-- catalogado, nulo quando partiu direto de um asset do Drive (uso antigo,
-- continua funcionando exatamente igual).

alter table reference_video_profiles
  add column if not exists reference_library_item_id uuid references reference_library_items (id) on delete set null;

create index if not exists idx_reference_video_profiles_library_item on reference_video_profiles (reference_library_item_id);
