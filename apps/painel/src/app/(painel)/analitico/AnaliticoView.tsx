import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { AreaIconBadge } from "@/components/ui/areaIcons";

interface Trafego {
  spend: number;
  impressions: number;
  clicks: number;
  compras: number;
  contaConectada: boolean;
}

interface CriacaoPorDepartamento {
  departamento: string;
  total: number;
}

interface MissaoPorStatus {
  status: string;
  total: number;
}

interface EtapaPorAgente {
  agente: string;
  total: number;
  concluidas: number;
  aprovacao: number;
}

interface CustoPorAgente {
  agente: string;
  centavos: number;
}

const FORMATADOR = new Intl.NumberFormat("pt-BR");
const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const RÓTULO_DEPARTAMENTO: Record<string, string> = {
  design: "Design",
  videomaker: "Vídeo",
  trafego: "Tráfego",
  conteudo: "Social",
  planejamento: "Planejamento",
};

const RÓTULO_AGENTE: Record<string, string> = {
  estrategia: "Estratégia",
  design: "Design",
  video: "Vídeo",
  "social-media": "Social",
  trafego: "Tráfego",
  growth: "Growth",
  analitico: "Analítico",
};

function centavosParaReais(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

export default function AnaliticoView({
  trafego,
  criacoes7dias,
  criacoesPorDepartamento,
  missoesPorStatus,
  etapasPorAgente,
  custoTotalCentavos,
  custoPorAgente,
  chamadasSemCusto,
  totalChamadas,
}: {
  trafego: Trafego;
  criacoes7dias: number;
  criacoesPorDepartamento: CriacaoPorDepartamento[];
  missoesPorStatus: MissaoPorStatus[];
  etapasPorAgente: EtapaPorAgente[];
  custoTotalCentavos: number;
  custoPorAgente: CustoPorAgente[];
  chamadasSemCusto: number;
  totalChamadas: number;
}) {
  const maiorContagemDepartamento = Math.max(1, ...criacoesPorDepartamento.map((c) => c.total));
  const maiorCusto = Math.max(1, ...custoPorAgente.map((c) => c.centavos));

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/analitico" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
            <h1 className="text-2xl font-bold text-areia">Analítico</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          Visão consolidada de tráfego, criações, missões e custo real de operação — dado agregado de tudo que as
          outras áreas já produzem, num lugar só.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl panel p-4">
            <p className="mono-label text-areia/40">Investido em tráfego</p>
            <p className="mt-1 font-mono text-xl text-areia">R$ {FORMATADOR.format(trafego.spend)}</p>
            <p className="mt-0.5 text-[11px] text-areia/40">{trafego.contaConectada ? "conta conectada" : "conta não conectada"}</p>
          </div>
          <div className="rounded-2xl panel p-4">
            <p className="mono-label text-areia/40">Criações (7 dias)</p>
            <p className="mt-1 font-mono text-xl text-areia">{criacoes7dias}</p>
            <p className="mt-0.5 text-[11px] text-areia/40">design, vídeo, social, tráfego</p>
          </div>
          <div className="rounded-2xl panel p-4">
            <p className="mono-label text-areia/40">Custo de operação</p>
            <p className="mt-1 font-mono text-xl text-areia">{centavosParaReais(custoTotalCentavos)}</p>
            <p className="mt-0.5 text-[11px] text-areia/40">
              {totalChamadas} chamada{totalChamadas === 1 ? "" : "s"}
              {chamadasSemCusto > 0 && ` · ${chamadasSemCusto} sem custo apurado`}
            </p>
          </div>
          <div className="rounded-2xl panel p-4">
            <p className="mono-label text-areia/40">Compras atribuídas</p>
            <p className="mt-1 font-mono text-xl text-areia">{FORMATADOR.format(trafego.compras)}</p>
            <p className="mt-0.5 text-[11px] text-areia/40">{FORMATADOR.format(trafego.clicks)} cliques no total</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="mono-label text-areia/50">Criações por frente</p>
              <Link href="/criacoes" className="text-xs text-menta hover:underline">
                ver galeria
              </Link>
            </div>
            {criacoesPorDepartamento.length > 0 ? (
              <div className="space-y-2 rounded-2xl panel p-4">
                {criacoesPorDepartamento
                  .sort((a, b) => b.total - a.total)
                  .map((c) => (
                    <div key={c.departamento} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-areia/70">{RÓTULO_DEPARTAMENTO[c.departamento] ?? c.departamento}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-petroleo">
                        <div
                          className="h-full rounded-full bg-menta"
                          style={{ width: `${Math.max(4, (c.total / maiorContagemDepartamento) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-xs text-areia">{c.total}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhuma criação ainda.</p>
            )}
          </section>

          <section>
            <p className="mono-label mb-3 text-areia/50">Custo por especialista</p>
            {custoPorAgente.length > 0 ? (
              <div className="space-y-2 rounded-2xl panel p-4">
                {custoPorAgente
                  .sort((a, b) => b.centavos - a.centavos)
                  .map((c) => (
                    <div key={c.agente} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-areia/70">{RÓTULO_AGENTE[c.agente] ?? c.agente}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-petroleo">
                        <div className="h-full btn-tactile rounded-full bg-ambar" style={{ width: `${Math.max(4, (c.centavos / maiorCusto) * 100)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-xs text-areia">{centavosParaReais(c.centavos)}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhuma chamada com custo apurado ainda.</p>
            )}
          </section>
        </div>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <p className="mono-label text-areia/50">Missões por status</p>
            <Link href="/missoes" className="text-xs text-menta hover:underline">
              ver missões
            </Link>
          </div>
          {missoesPorStatus.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {missoesPorStatus.map((m) => (
                <div key={m.status} className="rounded-2xl panel p-3 text-center">
                  <p className="font-mono text-lg text-areia">{m.total}</p>
                  <div className="mt-1.5 flex justify-center">
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhuma missão ainda.</p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Etapas por especialista</p>
          {etapasPorAgente.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {etapasPorAgente
                .sort((a, b) => b.total - a.total)
                .map((e) => (
                  <div key={e.agente} className="rounded-2xl panel p-4">
                    <p className="text-sm font-medium text-areia">{RÓTULO_AGENTE[e.agente] ?? e.agente}</p>
                    <p className="mt-1 text-xs text-areia/40">
                      {e.total} etapa{e.total === 1 ? "" : "s"} · {e.concluidas} concluída{e.concluidas === 1 ? "" : "s"}
                      {e.aprovacao > 0 && ` · ${e.aprovacao} aguardando aprovação`}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhuma etapa executada ainda.</p>
          )}
        </section>
      </div>
    </div>
  );
}
