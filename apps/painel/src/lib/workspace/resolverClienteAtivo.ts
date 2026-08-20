import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COOKIE_WORKSPACE = "vetor_workspace_cliente_id";

export interface ClienteAtivo {
  clienteId: string | null;
  clienteNome: string | null;
  usuarioNome: string | null;
  ehAdmin: boolean;
}

// Fase 8 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — "workspace
// limpo e workspace Dog King selecionável". Nunca muda RLS: current_papel()
// = 'admin_vetor' já ignora cliente_id em toda policy existente (ver
// migrations), então trocar de workspace é só uma decisão de QUAL
// cliente_id a aplicação usa nas próprias queries — não um bypass de
// segurança novo. Cliente comum (papel != admin_vetor) nunca consegue
// trocar, mesmo manipulando o cookie: a checagem do papel real acontece
// aqui, sempre a partir do banco, nunca confiando em nada vindo do cliente.
export async function resolverClienteAtivo(supabase: SupabaseClient): Promise<ClienteAtivo> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { clienteId: null, clienteNome: null, usuarioNome: null, ehAdmin: false };

  const { data: usuario } = await supabase.from("usuarios").select("nome, papel, cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario) return { clienteId: null, clienteNome: null, usuarioNome: null, ehAdmin: false };

  const ehAdmin = usuario.papel === "admin_vetor";
  let clienteId = usuario.cliente_id as string | null;

  if (ehAdmin) {
    const cookieStore = await cookies();
    const escolhido = cookieStore.get(COOKIE_WORKSPACE)?.value;
    if (escolhido) {
      // Nunca confia cegamente no cookie — confirma que o cliente existe
      // de verdade antes de usar (RLS já deixaria passar por ser admin,
      // isso aqui é só pra não filtrar por um id inválido/apagado).
      const { data: existe } = await supabase.from("clientes").select("id").eq("id", escolhido).maybeSingle();
      if (existe) clienteId = escolhido;
    }
  }

  const { data: cliente } = clienteId ? await supabase.from("clientes").select("nome_empresa").eq("id", clienteId).maybeSingle() : { data: null };

  return {
    clienteId,
    clienteNome: (cliente?.nome_empresa as string | undefined) ?? null,
    usuarioNome: usuario.nome as string | null,
    ehAdmin,
  };
}
