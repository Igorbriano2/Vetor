import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import VetorAppShell from "@/components/shell/VetorAppShell";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  // Fase 8 do reset de produto — lista de workspaces só é buscada (e só
  // aparece na UI) pra admin_vetor; um cliente comum nunca vê essa lista.
  const { data: workspaces } = ativo.ehAdmin
    ? await supabase.from("clientes").select("id, nome_empresa").order("nome_empresa")
    : { data: [] };

  return (
    <VetorAppShell
      orgNome={ativo.clienteNome ?? undefined}
      userNome={ativo.usuarioNome ?? undefined}
      ehAdmin={ativo.ehAdmin}
      workspaceAtivoId={ativo.clienteId}
      workspaces={(workspaces ?? []).map((w) => ({ id: w.id as string, nome: w.nome_empresa as string }))}
    >
      {children}
    </VetorAppShell>
  );
}
