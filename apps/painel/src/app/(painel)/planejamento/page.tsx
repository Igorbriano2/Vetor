import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import GerarPecasCampanha from "@/components/GerarPecasCampanha";
import CalendarioEditorial from "@/components/CalendarioEditorial";
import TrafegoPainel from "../trafego/TrafegoPainel";
import RotaEstrategicaView from "./RotaEstrategicaView";
import type { RotaEstrategica } from "./rotaEstrategicaTipos";

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

  const [{ data: planos }, { data: missoes }, { data: campanhasTrafego }, { data: analisesTrafego }, { data: conexaoMeta }, { data: criativosTrafego }] =
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
      // Fase 6 do VETOR Manager V2 — histórico de 8 análises (não só a
      // última) pra alimentar o gráfico de evolução real da Visão geral;
      // oportunidades/riscos/recomendacoes agora são populados de verdade
      // por gerarAnaliseDoGestor() em apps/agentes/src/connections/metaAdsSync.ts.
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
      // Design V2 (auditoria Gravyx — "Performance") — ranking real de
      // criativos por métrica, migration 0039.
      supabase
        .from("criativos_trafego")
        .select("id, nome, thumbnail_url, metricas, updated_at")
        .eq("cliente_id", clienteId)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

  const comHipotese = (missoes ?? []).filter((m) => m.hipotese);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Planejamento</h1>
        <p className="mt-2 text-sm text-areia/60">
          Calendário editorial mensal operacional, documentos de planejamento gerados pelo Vetor, as hipóteses por
          trás de cada missão já proposta, e o Gestor de Tráfego.
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
              historicoAnalises={analisesTrafego ?? []}
              contaConectada={!!conexaoMeta}
              criativosIniciais={criativosTrafego ?? []}
            />
          </div>
        ) : (
        <>
        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Calendário editorial
          </h2>
          <div className="mt-3">
            <CalendarioEditorial clienteId={clienteId} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Documentos de planejamento
          </h2>
          <div className="mt-3 space-y-4">
            {planos?.length ? (
              planos.map((p) => {
                const meta =
                  (p.metadata as {
                    content?: string;
                    periodo?: string;
                    calendario?: CalendarioItem[];
                    indicadores?: string[];
                    formato?: string;
                    rota?: RotaEstrategica;
                  } | null) ?? {};
                const calendario = Array.isArray(meta.calendario) ? meta.calendario : [];

                // Rota Estratégica (pedido explícito do cliente: análise +
                // plano de ação em formato de relatório executivo) — usa a
                // view rica em vez do card de texto genérico; o resto do
                // plano (calendário/indicadores) não se aplica a este formato.
                if (meta.formato === "rota_estrategica" && meta.rota) {
                  return (
                    <div key={p.id}>
                      <RotaEstrategicaView rota={meta.rota} />
                      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-areia/30">
                        <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                        {p.mission_id && (
                          <Link href={`/missoes/${p.mission_id}`} className="text-menta hover:underline">
                            ver missão
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={p.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-areia">{p.title}</p>
                      {meta.periodo && (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-ambar">{meta.periodo}</span>
                      )}
                    </div>
                    {meta.content && <p className="mt-2 whitespace-pre-wrap text-sm text-areia/70">{meta.content}</p>}

                    {/* Fase 5 do VETOR Manager V2 — o grid de dias que existia
                        aqui (extraído deste jsonb solto) foi substituído pelo
                        Calendário editorial real acima, com dado consultável
                        de verdade (calendario_itens). Este documento continua
                        existindo como o relatório textual que o Vetor gerou,
                        e "gerar peças" abaixo ainda funciona sobre o mesmo
                        array — não reescrevi esse fluxo, só a apresentação
                        duplicada. */}

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
