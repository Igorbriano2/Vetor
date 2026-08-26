import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import TrafegoPainel from "./TrafegoPainel";

// Navegação por especialista — Tráfego deixa de ser uma aba escondida dentro
// de /planejamento e vira área de primeiro nível própria (mesmo TrafegoPainel,
// mesma lógica de busca, só realocada pra cá).
export default async function TrafegoPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [{ data: campanhasTrafego }, { data: analisesTrafego }, { data: conexaoMeta }, { data: criativosTrafego }] =
    await Promise.all([
      supabase
        .from("campanhas_trafego")
        .select("id, nome, status, orcamento_centavos, metricas, updated_at")
        .eq("cliente_id", clienteId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("trafego_analises")
        .select("id, diagnostico, metricas_usadas, oportunidades, riscos, recomendacoes, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("connections")
        .select("status")
        .eq("cliente_id", clienteId)
        .eq("provider", "meta_ads")
        .eq("status", "connected")
        .maybeSingle(),
      supabase
        .from("criativos_trafego")
        .select("id, nome, thumbnail_url, metricas, updated_at")
        .eq("cliente_id", clienteId)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Tráfego</h1>
        <p className="mt-2 text-sm text-areia/60">Gestor de tráfego pago: campanhas, criativos e análise do gestor.</p>

        <div className="mt-6">
          <TrafegoPainel
            campanhasIniciais={campanhasTrafego ?? []}
            historicoAnalises={analisesTrafego ?? []}
            contaConectada={!!conexaoMeta}
            criativosIniciais={criativosTrafego ?? []}
          />
        </div>
      </div>
    </div>
  );
}
