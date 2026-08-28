import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import { detectarNicho } from "@/lib/aiSuite/detectarNicho";
import VideoIaClient from "./VideoIaClient";

// Módulo 2 do prompt-mestre da suíte de IA — Video Generator. Diferente de
// /videomaker (editor de timeline pra montar/cortar clipes já existentes):
// aqui o cliente GERA um clipe novo do zero, que pode depois virar fonte no
// /videomaker (ver docs/arquitetura-suite-ia.md).
export default async function VideoIaPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }

  const { data: perfil } = await supabase.from("business_profiles").select("categoria").eq("cliente_id", ativo.clienteId).maybeSingle();
  const nicho = detectarNicho(perfil?.categoria as string | null | undefined);

  return <VideoIaClient clienteId={ativo.clienteId} nicho={nicho} />;
}
