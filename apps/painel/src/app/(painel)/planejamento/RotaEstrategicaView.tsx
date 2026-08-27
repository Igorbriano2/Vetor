import type { RotaEstrategica } from "./rotaEstrategicaTipos";

// Anatomia auditada do relatório executivo (hero+KPIs, seções numeradas,
// stat-grid, tabela de performance com status-pill, campaign-cards,
// timeline dia a dia com marcador+barra de orçamento segmentada, checklist,
// métricas de acompanhamento) — só a estrutura/interação foi replicada, a
// paleta é 100% tokens do Vetor (petroleo/menta/ambar/electric/coral), nunca
// a paleta laranja/azul do documento de referência.

const CORES_CAMPANHA = ["var(--color-electric)", "var(--color-menta)", "var(--color-ambar)", "var(--color-coral)"];

function renderComNegrito(texto: string) {
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return partes.map((parte, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-areia">{parte}</strong> : <span key={i}>{parte}</span>));
}

function SectionHead({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3 border-b border-areia/10 pb-3">
      <span className="font-mono text-xs text-areia/30">{String(numero).padStart(2, "0")}</span>
      <h2 className="text-lg font-semibold text-areia">{titulo}</h2>
    </div>
  );
}

function StatGrid({ stats }: { stats: RotaEstrategica["diagnostico"]["stats"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl panel p-3">
          <p className="text-[11px] font-medium text-areia/40">{s.label}</p>
          <p className={`mt-1 font-mono text-xl font-bold ${s.alerta ? "text-coral" : "text-areia"}`}>{s.valor}</p>
          {s.nota && <p className="mt-0.5 text-[11px] text-areia/40">{s.nota}</p>}
        </div>
      ))}
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  good: "bg-menta/10 text-menta",
  warn: "bg-ambar/10 text-ambar",
  critical: "bg-coral/10 text-coral",
};

export default function RotaEstrategicaView({ rota }: { rota: RotaEstrategica }) {
  let secao = 0;
  const proximaSecao = () => ++secao;

  return (
    <div className="overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/40 backdrop-blur">
      <header className="border-b border-areia/10 bg-gradient-to-br from-electric/10 via-transparent to-transparent p-6">
        {rota.eyebrow && (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-menta">
            <span className="inline-block h-px w-5 bg-menta" />
            {rota.eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-balance text-2xl font-bold text-areia sm:text-3xl">{rota.titulo}</h1>
        <p className="mt-3 max-w-2xl text-sm text-areia/60">{renderComNegrito(rota.lede)}</p>

        {rota.kpis.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-areia/10 bg-areia/5 sm:grid-cols-4">
            {rota.kpis.map((kpi, i) => (
              <div key={i} className="bg-petroleo-2/80 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-areia/40">{kpi.label}</p>
                <p className={`mt-1 font-mono text-2xl font-bold ${kpi.alerta ? "text-coral" : "text-areia"}`}>{kpi.valor}</p>
                {kpi.contexto && <p className="mt-0.5 text-[11px] text-areia/40">{kpi.contexto}</p>}
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="space-y-10 p-6">
        <section>
          <SectionHead numero={proximaSecao()} titulo="Onde a conta está agora" />
          <p className="text-sm text-areia/70">{renderComNegrito(rota.diagnostico.resumo)}</p>
          {rota.diagnostico.stats.length > 0 && <div className="mt-4"><StatGrid stats={rota.diagnostico.stats} /></div>}
          {rota.diagnostico.porQueImporta && (
            <div className="mt-4 rounded-r-lg border-l-2 border-menta bg-menta/5 p-4">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-menta">Por que isso importa</p>
              <p className="text-sm text-areia/70">{renderComNegrito(rota.diagnostico.porQueImporta)}</p>
            </div>
          )}
        </section>

        {rota.mercado && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="Mercado e concorrência" />
            <p className="text-sm text-areia/70">{renderComNegrito(rota.mercado.resumo)}</p>
            {rota.mercado.stats.length > 0 && <div className="mt-4"><StatGrid stats={rota.mercado.stats} /></div>}
          </section>
        )}

        {rota.empresa && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="A empresa" />
            <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <p className="text-sm text-areia/70">{renderComNegrito(rota.empresa.resumo)}</p>
              {(rota.empresa.endereco || rota.empresa.horarios || rota.empresa.canais?.length) && (
                <div className="rounded-xl panel p-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                    {rota.empresa.endereco && (
                      <>
                        <dt className="font-medium text-areia/40">Endereço</dt>
                        <dd className="text-areia/80">{rota.empresa.endereco}</dd>
                      </>
                    )}
                    {rota.empresa.horarios && (
                      <>
                        <dt className="font-medium text-areia/40">Horários</dt>
                        <dd className="text-areia/80">{rota.empresa.horarios}</dd>
                      </>
                    )}
                  </dl>
                  {!!rota.empresa.canais?.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rota.empresa.canais.map((c, i) => (
                        <span key={i} className="rounded-full border border-areia/15 bg-petroleo/60 px-2.5 py-1 text-[11px] text-areia/60">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {rota.performance && rota.performance.linhas.length > 0 && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="O que já funcionou (e o que não)" />
            <div className="overflow-x-auto rounded-xl border border-areia/10">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-areia/10 bg-petroleo-2/80">
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-areia/40">Campanha</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-areia/40">Gasto</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-areia/40">Resultados</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-areia/40">Custo/resultado</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-areia/40">Leitura</th>
                  </tr>
                </thead>
                <tbody>
                  {rota.performance.linhas.map((l, i) => (
                    <tr key={i} className="border-b border-areia/5 bg-petroleo-2/40 last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-areia">{l.nome}</p>
                        {l.objetivo && <p className="text-[11px] text-areia/40">{l.objetivo}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-areia/80">{l.gasto}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-areia/80">{l.resultados}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-areia/80">{l.custoResultado}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[l.status]}`}>{l.leitura}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rota.performance.leitura && <p className="mt-3 text-sm text-areia/50">{renderComNegrito(rota.performance.leitura)}</p>}
          </section>
        )}

        {rota.estrategia.length > 0 && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="Estratégia" />
            <div className="grid gap-3 sm:grid-cols-2">
              {rota.estrategia.map((c, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl panel p-4">
                  <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: CORES_CAMPANHA[i % CORES_CAMPANHA.length] }} />
                  <p className="font-mono text-[11px] font-medium text-areia/40">{c.kicker}</p>
                  <h3 className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-areia">
                    <span className="inline-block size-2 shrink-0 rounded-sm" style={{ background: CORES_CAMPANHA[i % CORES_CAMPANHA.length] }} />
                    {c.titulo}
                  </h3>
                  <p className="mt-2 text-[13px] text-areia/60">{c.descricao}</p>
                  <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-areia/10 pt-3">
                    <span className="text-[11px] text-areia/40">Investido na semana</span>
                    <span className="font-mono text-lg font-bold text-areia">{c.investimentoSemana}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {rota.plano.length > 0 && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="Plano dia a dia" />
            {rota.estrategia.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-4 text-[12px] text-areia/50">
                {rota.estrategia.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: CORES_CAMPANHA[i % CORES_CAMPANHA.length] }} />
                    {c.titulo}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col">
              {rota.plano.map((dia, i) => {
                const total = dia.splitPorCampanha.reduce((s, v) => s + v, 0) || 1;
                return (
                  <div key={i} className={`grid grid-cols-[40px_1fr] gap-4 border-b border-areia/10 py-5 last:border-0`}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex size-9 items-center justify-center rounded-full font-mono text-sm font-bold ${
                          dia.climax ? "bg-coral text-petroleo" : "border border-areia/15 bg-petroleo-2 text-areia/70"
                        }`}
                      >
                        {dia.numero}
                      </div>
                      {i < rota.plano.length - 1 && <div className="mt-1 w-px flex-1 bg-areia/10" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <span className="text-[15px] font-semibold text-areia">{dia.data}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${dia.climax ? "bg-coral/10 text-coral" : "bg-menta/10 text-menta"}`}>
                          {dia.fase}
                        </span>
                        <span className="ml-auto font-mono text-sm font-semibold text-areia/60">{dia.totalDia}</span>
                      </div>
                      {dia.splitPorCampanha.length > 0 && (
                        <div className="mt-3 flex h-2 overflow-hidden rounded-full border border-areia/10">
                          {dia.splitPorCampanha.map((v, si) => (
                            <div key={si} style={{ width: `${(v / total) * 100}%`, background: CORES_CAMPANHA[si % CORES_CAMPANHA.length] }} />
                          ))}
                        </div>
                      )}
                      <ul className="mt-3 space-y-1.5">
                        {dia.acoes.map((a, ai) => (
                          <li key={ai} className="relative pl-4 text-[13.5px] text-areia/65">
                            <span className="absolute left-0 top-[.55em] size-1 rounded-full bg-menta" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {rota.checklist.length > 0 && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="Antes de publicar" />
            <div className="flex flex-col gap-2">
              {rota.checklist.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                    item.critico ? "border-coral/30 bg-coral/5" : "border-areia/10 bg-petroleo-2/60"
                  }`}
                >
                  <div className={`mt-0.5 size-4 shrink-0 rounded ${item.critico ? "bg-coral/20" : "border border-areia/20 bg-petroleo/60"}`} />
                  <div>
                    <p className="text-[13.5px] font-semibold text-areia">{item.titulo}</p>
                    <p className="text-[12.5px] text-areia/50">{item.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {rota.metricas.length > 0 && (
          <section>
            <SectionHead numero={proximaSecao()} titulo="Como acompanhar e decidir" />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {rota.metricas.map((m, i) => (
                <div key={i} className="rounded-xl panel p-3.5">
                  <h4 className="text-[13px] font-semibold text-areia">{m.nome}</h4>
                  <p className="mt-1 text-[12px] text-areia/50">{m.contexto}</p>
                  <p className="mt-1.5 font-mono text-[12px] font-semibold text-menta">{m.meta}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
