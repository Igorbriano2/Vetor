import { createSupabaseServerClient } from "@/lib/supabase/server";
import TrafegoPainel from "./TrafegoPainel";

export default async function TrafegoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();

  const [{ data: campanhas }, { data: analises }, { data: conexao }] = await Promise.all([
    supabase
      .from("campanhas_trafego")
      .select("id, nome, status, orcamento_centavos, metricas, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("trafego_analises")
      .select("id, diagnostico, metricas_usadas, created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    usuario?.cliente_id
      ? supabase
          .from("connections")
          .select("status")
          .eq("cliente_id", usuario.cliente_id)
          .eq("provider", "meta_ads")
          .eq("status", "connected")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Tráfego</h1>
        <p className="mt-2 text-sm text-areia/60">
          Dashboard de campanhas reais, o Gestor de Tráfego (o Vetor) e as conexões da conta de anúncios.
        </p>

        <TrafegoPainel
          campanhasIniciais={campanhas ?? []}
          analiseInicial={analises?.[0] ?? null}
          contaConectada={!!conexao}
        />
      </div>
    </div>
  );
}
