-- RETROATIVO — já aplicado em produção em 2026-08-17T17:08:34Z (versão remota
-- 20260817170834, nome "oauth_states_deny_client_access") entre 0013 e 0014,
-- direto via MCP, sem arquivo local correspondente na época. Adicionado agora
-- só pra fechar a lacuna de rastreabilidade encontrada em docs/STATUS-REAL-ATUAL.md
-- (achado da FASE 0 de reconciliação) — NÃO precisa ser reaplicado, já está
-- ativo. Statement copiado exatamente de supabase_migrations.schema_migrations
-- pra essa versão.

-- Torna explícito que oauth_states nunca é acessível via authenticated/anon
-- (só service_role, que ignora RLS) — fecha o advisory "RLS enabled no policy"
-- sem abrir acesso nenhum.
create policy "oauth_states: nunca acessivel por client-side"
  on oauth_states for all
  using (false)
  with check (false);
