-- ============================================================================
-- voices — 1ª voz real do catálogo, provider FishAudio (ver
-- apps/agentes/src/ai-providers/fishAudioAdapter.ts). Sem reference_id
-- próprio ainda (nenhuma voz clonada foi fornecida pelo cliente), então
-- provider_voice_id usa o sentinela "__default__": o adapter reconhece
-- esse valor e NÃO manda reference_id pra Fish Audio, deixando a API usar
-- a voz padrão dela mesma — honesto, nunca finge ser uma voz clonada
-- específica que não existe.
-- ============================================================================

insert into voices (id, cliente_id, provider_id, provider_voice_id, nome, idioma, genero, sotaque, preview_url)
values ('fishaudio-padrao', null, 'fishaudio', '__default__', 'Voz padrão', 'pt-BR', null, null, null)
on conflict (id) do nothing;
