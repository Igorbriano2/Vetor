import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import GerarPecasCampanha from "@/components/GerarPecasCampanha";
import TrafegoPainel from "../trafego/TrafegoPainel";

interface CalendarioItem {
  data: string;
  titulo: string;
  canal?: string;
  tipo?: string;
}

// Fase 4 do Vetor Manager — Tráfego passou a viver aqui como segunda aba
// (?aba=trafego), reaproveitando TrafegoPainel tal como era em /trafego
// (agora um redirect); nenhuma lógica de campanha foi duplicada ou reescrita.
export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba } = await searchParams;
  const abaAtiva = aba === "trafego" ? "trafego" : "planejamento";

  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [{ data: planos }, { data: missoes }, { data: campanhasTrafego }, { data: analisesTrafego }, { data: conexaoMeta }] =
    await Promise.all([
      supabase
        .from("artifacts")
        .select("id, title, description, mission_id, metadata, created_by_agent, created_at")
        .eq("type", "plan")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("missions")
        .select("id, titulo, objetivo, hipotese, criterio_sucesso, status, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("campanhas_trafego")
        .select("id, nome, status, orcamento_centavos, metricas, updated_at")
        .eq("cliente_id", clienteId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("trafego_analises")
        .select("id, diagnostico, metricas_usadas, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("connections")
        .select("status")
        .eq("cliente_id", clienteId)
        .eq("provider", "meta_ads")
        .eq("status", "connected")
        .maybeSingle(),
    ]);

  const comHipotese = (missoes ?? []).filter((m) => m.hipotese);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Planejamento</h1>
        <p className="mt-2 text-sm text-areia/60">
          Documentos de planejamento mensal (peça pelo chat: &ldquo;monte o planejamento de agosto&rdquo;), as
          hipóteses por trás de cada missão já proposta, e o Gestor de Tráfego.
        </p>

        <div className="mb-2 mt-6 flex gap-2 border-b border-areia/10">
          <Link
            href="/planejamento"
            className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${
              abaAtiva === "planejamento" ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"
            }`}
          >
            Planejamento
          </Link>
          <Link
            href="/planejamento?aba=trafego"
            className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${
              abaAtiva === "trafego" ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"
            }`}
          >
            Tráfego
          </Link>
        </div>

        {abaAtiva === "trafego" ? (
          <div className="mt-6">
            <TrafegoPainel
              campanhasIniciais={campanhasTrafego ?? []}
              analiseInicial={analisesTrafego?.[0] ?? null}
              contaConectada={!!conexaoMeta}
            />
          </div>
        ) : (
        <>
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
                        {/* Fase 5 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) —
                            grid de cards por dia em vez de lista plana de texto;
                            mesmo dado (calendario), só apresentação. */}
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {calendario
                            .slice()
                            .sort((a, b) => a.data.localeCompare(b.data))
                            .map((item, i) => {
                              const dataObj = new Date(`${item.data}T00:00:00`);
                              const diaValido = !Number.isNaN(dataObj.getTime());
                              return (
                                <div key={i} className="rounded-xl border border-areia/10 bg-petroleo/50 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-mono text-lg font-bold leading-none text-areia">
                                        {diaValido ? dataObj.getDate() : "—"}
                                      </p>
                                      <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">
                                        {diaValido ? dataObj.toLocaleDateString("pt-BR", { weekday: "short", month: "short" }) : item.data}
                                      </p>
                                    </div>
                                    {item.tipo && (
                                      <span className="rounded-full border border-areia/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-areia/50">
                                        {item.tipo}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs text-areia/80">{item.titulo}</p>
                                  {item.canal && (
                                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-menta">{item.canal}</p>
                                  )}
                                </div>
                              );
                            })}
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
        </>
        )}
      </div>
    </div>
  );
}
