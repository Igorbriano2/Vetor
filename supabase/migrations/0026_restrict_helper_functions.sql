-- RETROATIVO — já aplicado em produção em 2026-08-10T15:11:35Z (versão remota
-- 20260810151135, nome "restrict_helper_functions") logo depois de 0001_init,
-- direto via MCP, sem arquivo local correspondente na época. Adicionado agora
-- só pra fechar a lacuna de rastreabilidade encontrada em docs/STATUS-REAL-ATUAL.md
-- (achado da FASE 0 de reconciliação) — NÃO precisa ser reaplicado, já está
-- ativo. Statements copiados exatamente de
-- supabase_migrations.schema_migrations pra essa versão.
--
-- current_cliente_id()/current_papel() são funções SECURITY DEFINER usadas nas
-- policies de RLS — sem esse revoke/grant explícito, o role "anon" (visitante
-- sem sessão) também conseguia executá-las via RPC, vazando informação que só
-- devia estar disponível pra quem já está autenticado.

revoke execute on function current_cliente_id() from public, anon;
revoke execute on function current_papel() from public, anon;
grant execute on function current_cliente_id() to authenticated;
grant execute on function current_papel() to authenticated;
