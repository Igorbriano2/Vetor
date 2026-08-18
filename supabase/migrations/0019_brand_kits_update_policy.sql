-- brand_kits nunca teve política de UPDATE (só INSERT/SELECT) — descoberto ao
-- testar ao vivo o painel "Logo oficial": o PATCH retornava 204 mas RLS
-- filtrava a linha silenciosamente (0 rows affected, sem erro), então nenhuma
-- variante de logo era persistida. Mesmo padrão de "cliente edita os
-- próprios" já usado em business_assets/business_asset_folders.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'brand_kits' and policyname = 'brand_kits: cliente edita o proprio'
  ) then
    create policy "brand_kits: cliente edita o proprio" on public.brand_kits
      for update
      using (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor')
      with check (cliente_id = current_cliente_id() or current_papel() = 'admin_vetor');
  end if;
end $$;
