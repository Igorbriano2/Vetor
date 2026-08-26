import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import GerarPecasCampanha from "@/components/GerarPecasCampanha";
import CalendarioEditorial from "@/components/CalendarioEditorial";

interface CalendarioItem {
  data: string;
  titulo: string;
  canal?: string;
  tipo?: string;
}

// Navegação por especialista — Tráfego saiu daqui e virou área própria
// (/trafego), TrafegoPainel realocado pra lá. Hipóteses em jogo e Rotas
// Estratégicas (artifacts metadata.formato="rota_estrategica") também
// saíram e viraram parte de /estrategia (EstrategiaCommandCenter). Aqui
// fica só o que é genuinamente "planejamento": calendário editorial e
// documentos de plano comuns (periodo/calendario/indicadores).
export default async function PlanejamentoPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const { data: planos } = await supabase
    .from("artifacts")
    .select("id, title, description, mission_id, metadata, created_by_agent, created_at")
    .eq("type", "plan")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  const documentos = (planos ?? []).filter((p) => {
    const meta = (p.metadata as { formato?: string } | null) ?? {};
    return meta.formato !== "rota_estrategica";
  });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Planejamento</h1>
        <p className="mt-2 text-sm text-areia/60">
          Calendário editorial mensal operacional e documentos de planejamento gerados pelo Vetor.
        </p>

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
            {documentos.length ? (
              documentos.map((p) => {
                const meta =
                  (p.metadata as {
                    content?: string;
                    periodo?: string;
                    calendario?: CalendarioItem[];
                    indicadores?: string[];
                  } | null) ?? {};
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
      </div>
    </div>
  );
}
