import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import { detectarNicho } from "@/lib/aiSuite/detectarNicho";
import VozClient from "./VozClient";

// Módulo 3 do prompt-mestre da suíte de IA — Voice Generator. Provider real
// planejado: FishAudio (decisão registrada em docs/arquitetura-suite-ia.md
// no lugar de ElevenLabs) — só MockAdapter ativo nesta rodada.
export default async function VozPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }

  const { data: perfil } = await supabase.from("business_profiles").select("categoria").eq("cliente_id", ativo.clienteId).maybeSingle();
  const nicho = detectarNicho(perfil?.categoria as string | null | undefined);

  return <VozClient nicho={nicho} />;
}
