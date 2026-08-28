import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import TresDClient from "./TresDClient";

// Módulo 5 do prompt-mestre — 3D Scenes, escopo reduzido nesta rodada
// (docs/arquitetura-suite-ia.md): prioriza "Meu espaço real" (maior valor
// comercial — tour 3D do estabelecimento a partir de fotos de celular).
// Sem viewer 3D real ainda (nenhum provider real configurado pra gerar um
// modelo de verdade pra visualizar — nunca finge um viewer vazio).
export default async function TresDPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }

  return <TresDClient clienteId={ativo.clienteId} />;
}
