import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GerarPecasCampanha from "@/components/GerarPecasCampanha";

interface CalendarioItem {
  data: string;
  titulo: string;
  canal?: string;
  tipo?: string;
}

export default async function PlanejamentoPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: planos }, { data: missoes }] = await Promise.all([
    supabase
      .from("artifacts")
      .select("id, title, description, mission_id, metadata, created_by_agent, created_at")
      .eq("type", "plan")
      .order("created_at", { ascending: false }),
    supabase
      .from("missions")
      .select("id, titulo, objetivo, hipotese, criterio_sucesso, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const comHipotese = (missoes ?? []).filter((m) => m.hipotese);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Planejamento</h1>
        <p className="mt-2 text-sm text-areia/60">
          Documentos de planejamento mensal (peça pelo chat: &ldquo;monte o planejamento de agosto&rdquo;) e as
          hipóteses por trás de cada missão já proposta.
        </p>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Planejamentos mensais
          </h2>
          <div className="mt-3 space-y-4">
            {planos?.length ? (
              planos.map((p) => {
                const meta = (p.metadata as { content?: string; periodo?: string; calendario?: CalendarioItem[]; indicadores?: string[] } | null) ?? {};
                const calendario = Array.isArray(meta.calendario) ? meta.calendario : [];
                return (
                  <div key={p.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-areia">{p.title}</p>
                      {meta.periodo && (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-ambar">{meta.periodo}</span>
                      )}
                    </div>
                    {meta.content && <p className="mt-2 whitespace-pre-wrap text-sm text-areia/70">{meta.content}</p>}

                    {calendario.length > 0 && (
                      <div className="mt-4">
                        <p className="mono-label">Calendário editorial</p>
                        <div className="mt-2 space-y-1.5">
                          {calendario
                            .slice()
                            .sort((a, b) => a.data.localeCompare(b.data))
                            .map((item, i) => (
                              <div key={i} className="flex items-center gap-3 rounded-lg border border-areia/10 bg-petroleo/50 px-3 py-2 text-xs">
                                <span className="font-mono text-areia/40">{item.data}</span>
                                <span className="flex-1 text-areia/80">{item.titulo}</span>
                                {item.canal && <span className="text-areia/40">{item.canal}</span>}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {calendario.length > 0 && (
                      <GerarPecasCampanha tituloPlano={p.title} periodo={meta.periodo} calendario={calendario} />
                    )}

                    {Array.isArray(meta.indicadores) && meta.indicadores.length > 0 && (
                      <div className="mt-3">
                        <p className="mono-label">Indicadores sugeridos</p>
                        <ul className="mt-1 space-y-0.5 text-xs text-areia/60">
                          {meta.indicadores.map((ind, i) => (
                            <li key={i}>• {ind}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-areia/30">
                      <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                      {p.mission_id && (
                        <Link href={`/missoes/${p.mission_id}`} className="text-menta hover:underline">
                          ver missão
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhum planejamento mensal ainda — peça pro Vetor no chat.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Hipóteses em jogo
          </h2>
          <div className="mt-3 space-y-3">
            {comHipotese.length ? (
              comHipotese.map((m) => (
                <Link
                  key={m.id}
                  href={`/missoes/${m.id}`}
                  className="block rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
                >
                  <p className="font-medium text-areia">{m.titulo}</p>
                  <p className="mt-1 text-sm text-areia/70">
                    <span className="text-areia/50">Hipótese:</span> {m.hipotese}
                  </p>
                  {Array.isArray(m.criterio_sucesso) && m.criterio_sucesso.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-areia/50">
                      {m.criterio_sucesso.map((c: string, i: number) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  )}
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhuma missão com hipótese registrada ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
