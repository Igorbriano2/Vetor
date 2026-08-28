import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import { detectarNicho } from "@/lib/aiSuite/detectarNicho";
import ImagemClient from "./ImagemClient";

// Módulo 1 do prompt-mestre da suíte de IA (docs/arquitetura-suite-ia.md) —
// "estúdio direto" de geração de imagem, caminho novo e paralelo ao fluxo
// de agente que já existe em /design. Server component só resolve
// cliente_id + nicho (pro estado vazio da galeria de templates já abrir no
// nicho certo); toda a interação de verdade é client-side (ModelPicker,
// geração, polling de status).
export default async function ImagemPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }

  const { data: perfil } = await supabase.from("business_profiles").select("categoria").eq("cliente_id", ativo.clienteId).maybeSingle();
  const nicho = detectarNicho(perfil?.categoria as string | null | undefined);

  return <ImagemClient clienteId={ativo.clienteId} nicho={nicho} />;
}
