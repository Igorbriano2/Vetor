-- Habilita Supabase Realtime em mission_steps/approvals pra timeline viva no
-- painel (VetorMissionTimeline assina postgres_changes) sem precisar de infra
-- de streaming nova — RLS já existente continua valendo pros eventos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mission_steps'
  ) then
    alter publication supabase_realtime add table public.mission_steps;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'approvals'
  ) then
    alter publication supabase_realtime add table public.approvals;
  end if;
end $$;
