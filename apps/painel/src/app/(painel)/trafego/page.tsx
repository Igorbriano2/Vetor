import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";

function centavosParaReais(centavos: number | null): string {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function TrafegoPage() {
  const supabase = await createSupabaseServerClient();

  const { data: campanhas } = await supabase
    .from("campanhas_trafego")
    .select("id, nome, status, orcamento_centavos, teto_custo_resultado_centavos, metricas, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Tráfego</h1>
        <p className="mt-2 text-sm text-areia/60">
          Modo leitura e planejamento — publicar, pausar ou ajustar orçamento passa pelo Policy Engine e exige
          aprovação, então essas ações ainda não estão disponíveis por aqui.
        </p>

        <div className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4">
          <p className="mono-label">Contas conectadas</p>
          <p className="mt-2 text-sm text-areia/40">
            Nenhuma conta de mídia (Meta Ads / Google Ads) conectada ainda.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Campanhas
          </h2>
          <div className="mt-3 space-y-3">
            {campanhas?.length ? (
              campanhas.map((c) => (
                <div key={c.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-areia">{c.nome}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-areia/50">
                    <span>Orçamento: {centavosParaReais(c.orcamento_centavos)}</span>
                    <span>Teto de custo por resultado: {centavosParaReais(c.teto_custo_resultado_centavos)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhuma campanha registrada ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
