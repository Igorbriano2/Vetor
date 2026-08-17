import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InsightsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: relatorios } = await supabase
    .from("relatorios")
    .select("id, periodo_inicio, periodo_fim, conteudo, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: atividade } = await supabase
    .from("log_agentes")
    .select("id, agente, acao, justificativa, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Insights</h1>
        <p className="mt-2 text-sm text-areia/60">
          Sinais e diagnósticos, sempre com a evidência por trás — sem prometer resultado, só apontar hipótese
          e próximo teste.
        </p>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Relatórios de período
          </h2>
          <div className="mt-3 space-y-3">
            {relatorios?.length ? (
              relatorios.map((r) => (
                <div key={r.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
                  <p className="font-medium text-areia">
                    {new Date(r.periodo_inicio).toLocaleDateString("pt-BR")} —{" "}
                    {new Date(r.periodo_fim).toLocaleDateString("pt-BR")}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-petroleo/60 p-3 text-xs text-areia/60">
                    {JSON.stringify(r.conteudo, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhum relatório de período gerado ainda.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Atividade recente dos agentes
          </h2>
          <div className="mt-3 space-y-2 border-l border-areia/10 pl-5">
            {atividade?.length ? (
              atividade.map((a) => (
                <div key={a.id} className="relative rounded-xl border border-areia/10 bg-petroleo-2/50 p-3">
                  <span className="absolute top-4 -left-[25px] size-2 rounded-full bg-menta" />
                  <p className="text-sm text-areia">
                    <span className="font-medium">{a.agente}</span> — {a.acao}
                  </p>
                  <p className="mt-0.5 text-xs text-areia/50">{a.justificativa}</p>
                  <p className="mt-1 font-mono text-[10px] text-areia/30">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhuma atividade registrada ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
