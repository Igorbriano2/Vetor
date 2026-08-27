"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { readApiResponse } from "@/lib/api/readApiResponse";
import { salvarPrefillComando } from "@/lib/conversation";
import FunilConversao from "./FunilConversao";
import LeaderboardCriativos, { type Criativo } from "./LeaderboardCriativos";

interface Campanha {
  id: string;
  nome: string;
  status: string;
  orcamento_centavos: number | null;
  metricas: Record<string, unknown>;
  updated_at: string;
}

interface CriativoBanco {
  id: string;
  nome: string;
  thumbnail_url: string | null;
  metricas: Record<string, unknown>;
  updated_at: string;
}

interface Recomendacao {
  titulo: string;
  impacto_esperado: string;
  confianca: "alta" | "media" | "baixa";
  tarefa: string;
}

interface Analise {
  id: string;
  diagnostico: string | null;
  metricas_usadas: Record<string, unknown>;
  oportunidades: string[] | null;
  riscos: string[] | null;
  recomendacoes: Recomendacao[] | null;
  created_at: string;
}

function centavosParaReais(centavos: number | null): string {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function reais(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percentual(valor: number | null, casas = 2): string {
  if (valor == null) return "—";
  return `${valor.toFixed(casas)}%`;
}

// Dashboard "todas as métricas do Facebook Ads" (pedido explícito) — cada
// entrada é uma métrica selecionável independentemente, igual ao Reportei.
// Sempre ordenado igual (ordem desta lista), independente da ordem que o
// cliente marcou — evita o grid "pular" métrica de posição a cada reload.
type KpiId = "investimento" | "impressoes" | "alcance" | "cliques" | "ctr" | "cpc" | "cpm" | "frequencia" | "compras" | "custo_por_compra" | "receita" | "roas" | "roi";

const CHAVE_LOCALSTORAGE_METRICAS = "vetor:trafego:metricas-visiveis";

// Ordem canônica de TODAS as métricas — usada tanto pro seletor quanto pra
// nunca deixar o grid de KPIs "pular de posição" conforme o que o cliente
// marca/desmarca (ordem sempre a mesma, só o subconjunto visível muda).
const ORDEM_METRICAS: KpiId[] = [
  "investimento",
  "impressoes",
  "alcance",
  "cliques",
  "ctr",
  "cpc",
  "cpm",
  "frequencia",
  "compras",
  "custo_por_compra",
  "receita",
  "roas",
  "roi",
];

const METRICAS_PADRAO: KpiId[] = ["investimento", "impressoes", "cliques", "ctr", "cpc", "compras", "roas", "roi"];

const LABEL_METRICA: Record<KpiId, string> = {
  investimento: "Investimento",
  impressoes: "Impressões",
  alcance: "Alcance",
  cliques: "Cliques",
  ctr: "CTR médio",
  cpc: "CPC médio",
  cpm: "CPM médio",
  frequencia: "Frequência média",
  compras: "Compras",
  custo_por_compra: "Custo por compra (CPA)",
  receita: "Receita",
  roas: "ROAS",
  roi: "ROI",
};

// Design V2 (auditoria Gravyx — módulo "Performance") — reduzido de 4 pra 3
// abas: "Conexões" virou uma linha de status fixa no topo (era uma aba
// quase vazia, só um link) em vez de disputar espaço com as abas de
// verdade. Pedido explícito do dono do produto: "fazer um planejamento
// pra o Vetor não ficar carregado de informação que mais atrapalha do que
// ajuda" — cada aba que sobra precisa realmente merecer o espaço.
const ABAS = ["visao_geral", "campanhas", "gestor"] as const;
type Aba = (typeof ABAS)[number];
const LABEL_ABA: Record<Aba, string> = { visao_geral: "Visão geral", campanhas: "Campanhas", gestor: "Análise do Gestor" };

const COR_CONFIANCA: Record<Recomendacao["confianca"], string> = {
  alta: "border-menta/30 text-menta",
  media: "border-ambar/30 text-ambar",
  baixa: "border-areia/20 text-areia/50",
};

// Fase 6 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md, decisão #3)
// — dataset DEMO fixo NO CÓDIGO, nunca no banco: impossível de vazar como
// dado real por engano (uma seed no banco poderia). Usado só quando não
// há conta conectada E nenhuma campanha real já sincronizada. Todo card
// que usa este dado mostra um selo "DEMO" visível — nunca se apresenta
// como número real.
const CAMPANHAS_DEMO: Campanha[] = [
  {
    id: "demo-1",
    nome: "[DEMO] Combo Sexta — Feed + Stories",
    status: "ativa",
    orcamento_centavos: 5000,
    metricas: {
      spend: "142.30",
      impressions: "18420",
      reach: "12100",
      clicks: "612",
      ctr: "3.32",
      cpc: "0.23",
      cpm: "7.72",
      frequency: "1.52",
      compras: 9,
      receita: 810,
      roas: 5.69,
      roi: 4.69,
      custo_por_compra: 15.81,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    nome: "[DEMO] Retargeting — Carrinho abandonado",
    status: "ativa",
    orcamento_centavos: 3000,
    metricas: {
      spend: "88.10",
      impressions: "9310",
      reach: "6420",
      clicks: "301",
      ctr: "3.23",
      cpc: "0.29",
      cpm: "9.46",
      frequency: "1.45",
      compras: 4,
      receita: 320,
      roas: 3.63,
      roi: 2.63,
      custo_por_compra: 22.03,
    },
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    nome: "[DEMO] Lançamento produto novo",
    status: "pausada",
    orcamento_centavos: 8000,
    metricas: {
      spend: "0.00",
      impressions: "0",
      reach: "0",
      clicks: "0",
      ctr: "0",
      cpc: "0",
      cpm: "0",
      frequency: "0",
      compras: 0,
      receita: 0,
      roas: null,
      roi: null,
      custo_por_compra: null,
    },
    updated_at: new Date().toISOString(),
  },
];

// Design V2 (auditoria Gravyx) — dataset DEMO do ranking de criativos,
// mesmo princípio: nunca no banco, sempre rotulado [DEMO].
const CRIATIVOS_DEMO: Criativo[] = [
  { id: "demo-c1", nome: "[DEMO] Combo Sexta — variação vídeo", thumbnailUrl: null, spend: 61.2, clicks: 288, compras: 6, cpc: 0.21, ctr: 3.9 },
  { id: "demo-c2", nome: "[DEMO] Combo Sexta — variação foto", thumbnailUrl: null, spend: 81.1, clicks: 324, compras: 3, cpc: 0.25, ctr: 2.8 },
  { id: "demo-c3", nome: "[DEMO] Retargeting — depoimento", thumbnailUrl: null, spend: 44.3, clicks: 190, compras: 4, cpc: 0.23, ctr: 3.4 },
  { id: "demo-c4", nome: "[DEMO] Retargeting — oferta direta", thumbnailUrl: null, spend: 43.8, clicks: 111, compras: 0, cpc: 0.39, ctr: 1.9 },
];

const ANALISE_DEMO: Analise = {
  id: "demo",
  diagnostico:
    "[DEMO] As campanhas de Sexta e Retargeting estão performando dentro do esperado (CTR acima de 3%). A campanha de Lançamento está pausada com verba reservada sem gasto.",
  metricas_usadas: { spend: 230.4, impressions: 27730, reach: 18520, clicks: 913, compras: 13 },
  oportunidades: ["[DEMO] CTR consistente acima de 3% sugere criativo com boa aceitação — espaço pra testar aumento de orçamento."],
  riscos: ["[DEMO] Campanha de Lançamento pausada há dias com orçamento reservado sem gerar resultado."],
  recomendacoes: [
    {
      titulo: "[DEMO] Reativar campanha de Lançamento com criativo atualizado",
      impacto_esperado: "Pode gerar ~300 impressões/dia adicionais",
      confianca: "media",
      tarefa: "Reativar a campanha de Lançamento com um criativo novo",
    },
  ],
  created_at: new Date().toISOString(),
};

function paraCriativo(c: CriativoBanco): Criativo {
  const m = c.metricas ?? {};
  const spend = Number(m.spend ?? 0);
  const clicks = Number(m.clicks ?? 0);
  return {
    id: c.id,
    nome: c.nome,
    thumbnailUrl: c.thumbnail_url,
    spend,
    clicks,
    compras: Number(m.compras ?? 0),
    cpc: m.cpc != null ? Number(m.cpc) : clicks > 0 ? spend / clicks : null,
    ctr: m.ctr != null ? Number(m.ctr) : null,
  };
}

export default function TrafegoPainel({
  campanhasIniciais,
  historicoAnalises,
  contaConectada,
  criativosIniciais,
}: {
  campanhasIniciais: Campanha[];
  historicoAnalises: Analise[];
  contaConectada: boolean;
  criativosIniciais: CriativoBanco[];
}) {
  const [aba, setAba] = useState<Aba>("visao_geral");
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campanhaExpandida, setCampanhaExpandida] = useState<string | null>(null);
  const [metricasVisiveis, setMetricasVisiveis] = useState<KpiId[]>(METRICAS_PADRAO);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const router = useRouter();

  // Preferência é por navegador/dispositivo (localStorage), não por conta
  // — mesma lógica de "estilo Reportei" pedida: cada pessoa que abre o
  // painel escolhe o próprio recorte de métricas, sem afetar o que os
  // outros usuários daquele cliente veem.
  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_LOCALSTORAGE_METRICAS);
    if (!salvo) return;
    try {
      const lista = JSON.parse(salvo) as string[];
      const validas = lista.filter((id): id is KpiId => id in LABEL_METRICA);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (validas.length > 0) setMetricasVisiveis(validas);
    } catch {
      // localStorage corrompido/formato antigo — ignora e mantém o padrão.
    }
  }, []);

  function alternarMetrica(id: KpiId) {
    setMetricasVisiveis((atual) => {
      const novo = atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id];
      const ordenado = ORDEM_METRICAS.filter((m) => novo.includes(m));
      window.localStorage.setItem(CHAVE_LOCALSTORAGE_METRICAS, JSON.stringify(ordenado));
      return ordenado;
    });
  }

  // Dataset DEMO só entra em jogo quando não há nada real ainda — assim
  // que existir 1 campanha real sincronizada, os dados reais tomam conta,
  // mesmo sem conexão ativa no momento (histórico já sincronizado antes).
  const usandoDemo = !contaConectada && campanhasIniciais.length === 0;
  const campanhas = usandoDemo ? CAMPANHAS_DEMO : campanhasIniciais;
  const analise = usandoDemo ? ANALISE_DEMO : (historicoAnalises[0] ?? null);
  const historico = usandoDemo ? [ANALISE_DEMO] : historicoAnalises;
  const criativos = usandoDemo ? CRIATIVOS_DEMO : criativosIniciais.map(paraCriativo);

  async function sincronizar() {
    setSincronizando(true);
    setErro(null);
    try {
      const res = await fetch("/api/trafego/sincronizar", { method: "POST" });
      if (res.status === 409) {
        setErro("Nenhuma conta de anúncios conectada ainda — conecte em Conexões.");
        return;
      }
      await readApiResponse(res);
      window.location.reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui sincronizar agora.");
    } finally {
      setSincronizando(false);
    }
  }

  function pedirAoVetor(texto: string) {
    salvarPrefillComando(texto);
    router.push("/vetor");
  }

  // KPIs agregados reais — só soma o que existe de verdade na métrica de
  // cada campanha (Graph API), nunca preenche um campo ausente com 0
  // fingindo que foi medido.
  const totalSpend = campanhas.reduce((s, c) => s + Number(c.metricas?.spend ?? 0), 0);
  const totalImpressions = campanhas.reduce((s, c) => s + Number(c.metricas?.impressions ?? 0), 0);
  const totalReach = campanhas.reduce((s, c) => s + Number(c.metricas?.reach ?? 0), 0);
  const totalClicks = campanhas.reduce((s, c) => s + Number(c.metricas?.clicks ?? 0), 0);
  const totalCompras = campanhas.reduce((s, c) => s + Number(c.metricas?.compras ?? 0), 0);
  const totalReceita = campanhas.reduce((s, c) => s + Number(c.metricas?.receita ?? 0), 0);
  const ctrMedio = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
  const cpcMedio = totalClicks > 0 ? totalSpend / totalClicks : null;
  const cpmMedio = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null;
  const custoPorCompraMedio = totalCompras > 0 ? totalSpend / totalCompras : null;
  const roasMedio = totalSpend > 0 ? totalReceita / totalSpend : null;
  const roiMedio = totalSpend > 0 ? ((totalReceita - totalSpend) / totalSpend) * 100 : null;
  const frequenciasValidas = campanhas.map((c) => Number(c.metricas?.frequency ?? NaN)).filter((v) => !Number.isNaN(v));
  const frequenciaMedia = frequenciasValidas.length > 0 ? frequenciasValidas.reduce((a, b) => a + b, 0) / frequenciasValidas.length : null;

  // Um único objeto de "valor calculado" por métrica — o grid de KPIs e o
  // seletor de métricas leem daqui, nunca duplicam a conta em dois lugares.
  const valorDaMetrica: Record<KpiId, string> = {
    investimento: reais(totalSpend),
    impressoes: totalImpressions.toLocaleString("pt-BR"),
    alcance: totalReach.toLocaleString("pt-BR"),
    cliques: totalClicks.toLocaleString("pt-BR"),
    ctr: percentual(ctrMedio),
    cpc: reais(cpcMedio),
    cpm: reais(cpmMedio),
    frequencia: frequenciaMedia != null ? frequenciaMedia.toFixed(2) : "—",
    compras: totalCompras.toLocaleString("pt-BR"),
    custo_por_compra: reais(custoPorCompraMedio),
    receita: reais(totalReceita),
    roas: roasMedio != null ? `${roasMedio.toFixed(2)}x` : "—",
    roi: percentual(roiMedio, 1),
  };

  // Alertas derivados de dado real (nunca uma meta/threshold fabricada
  // sem base) — campanha pausada com orçamento reservado é um sinal
  // objetivo de verba parada.
  const alertas = campanhas.filter((c) => c.status === "pausada" && (c.orcamento_centavos ?? 0) > 0);

  const serieGasto = historico
    .slice()
    .reverse()
    .map((a) => Number(a.metricas_usadas?.spend ?? 0));

  return (
    <div className="mt-6">
      {/* Design V2 (auditoria Gravyx) — "Conexões" deixou de ser aba: uma
          linha de status sempre visível, junto do resto do cabeçalho,
          igual ao "Conectar com Gravyx System User" que fica sempre à
          vista no Performance deles, nunca escondido atrás de um clique. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ABAS.map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                aba === a ? "border-menta text-menta bg-menta/10" : "border-areia/15 text-areia/60 hover:border-menta/40"
              }`}
            >
              {LABEL_ABA[a]}
            </button>
          ))}
        </div>
        <Link
          href="/conexoes"
          className={`rounded-full border px-3 py-1 text-[11px] transition ${contaConectada ? "border-menta/30 text-menta" : "border-areia/15 text-areia/50 hover:border-menta/30"}`}
        >
          {contaConectada ? "● conta de anúncios conectada" : "○ conectar conta de anúncios"}
        </Link>
      </div>

      {usandoDemo && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-ambar/30 bg-ambar/10 px-3 py-2 text-xs text-ambar">
          <span className="rounded border border-ambar/40 px-1.5 py-0.5 font-mono text-[10px]">DEMO</span>
          Nenhuma conta de anúncios conectada ainda — mostrando dados de demonstração pra você conhecer o painel.
          Conecte em <Link href="/conexoes" className="underline underline-offset-2">Conexões</Link> pra ver seus números reais.
        </div>
      )}

      {aba === "visao_geral" && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-areia/50">
              {analise && !usandoDemo ? `Última sincronização: ${new Date(analise.created_at).toLocaleString("pt-BR")}` : usandoDemo ? "Dados de demonstração" : "Ainda não sincronizado."}
            </p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setSeletorAberto((v) => !v)}
                  className="rounded-full border border-areia/15 px-4 py-1.5 text-xs text-areia/70 transition hover:border-menta/40 hover:text-menta"
                >
                  Personalizar métricas
                </button>
                {seletorAberto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSeletorAberto(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-areia/15 bg-petroleo-2 p-3 shadow-xl">
                      <p className="mono-label mb-2 text-areia/40">Métricas visíveis</p>
                      <div className="max-h-72 space-y-1 overflow-y-auto">
                        {ORDEM_METRICAS.map((id) => (
                          <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-areia hover:bg-areia/5">
                            <input
                              type="checkbox"
                              checked={metricasVisiveis.includes(id)}
                              onChange={() => alternarMetrica(id)}
                              className="h-3.5 w-3.5 accent-menta"
                            />
                            {LABEL_METRICA[id]}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {contaConectada && (
                <button
                  onClick={sincronizar}
                  disabled={sincronizando}
                  className="btn-tactile rounded-full bg-ambar px-4 py-1.5 text-xs font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
                >
                  {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
                </button>
              )}
            </div>
          </div>
          {erro && <p className="text-xs text-coral">{erro}</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {metricasVisiveis.length === 0 ? (
              <p className="col-span-full text-xs text-areia/40">
                Nenhuma métrica selecionada — escolha ao menos uma em &ldquo;Personalizar métricas&rdquo;.
              </p>
            ) : (
              metricasVisiveis.map((id) => {
                const destacarRoi = id === "roi" && roiMedio != null;
                return (
                  <div key={id} className="rounded-xl panel p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">{LABEL_METRICA[id]}</p>
                    <p className={`mt-1 text-lg font-semibold ${destacarRoi ? (roiMedio! >= 0 ? "text-menta" : "text-coral") : "text-areia"}`}>
                      {valorDaMetrica[id]}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Design V2 (auditoria Gravyx) — ranking de criativos, pedido
              explícito de copiar o "Top 5 criativos" do Performance deles. */}
          <LeaderboardCriativos criativos={criativos} />

          {/* Design V2 (auditoria Gravyx) — funil de conversão visual,
              mesmo pedido explícito. */}
          <FunilConversao impressoes={totalImpressions} alcance={totalReach} cliques={totalClicks} compras={totalCompras} />

          {serieGasto.length > 1 && (
            <div className="rounded-xl panel p-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">Evolução do investimento</p>
              <svg viewBox="0 0 100 28" className="mt-2 h-10 w-full" preserveAspectRatio="none">
                <polyline
                  points={serieGasto.map((v, i) => `${(i / (serieGasto.length - 1)) * 100},${28 - (v / Math.max(1, ...serieGasto)) * 24 - 2}`).join(" ")}
                  fill="none"
                  stroke="var(--color-menta)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          {alertas.length > 0 && (
            <div className="rounded-xl border border-coral/30 bg-coral/5 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-coral">Alertas</p>
              <ul className="mt-1 space-y-1 text-xs text-areia/70">
                {alertas.map((c) => (
                  <li key={c.id}>• &ldquo;{c.nome}&rdquo; está pausada com {centavosParaReais(c.orcamento_centavos)} de orçamento reservado.</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {aba === "campanhas" && (
        <div className="mt-6 space-y-3">
          {campanhas.length ? (
            campanhas.map((c) => (
              <div key={c.id} className="rounded-2xl panel">
                <button onClick={() => setCampanhaExpandida((atual) => (atual === c.id ? null : c.id))} className="flex w-full items-center justify-between gap-4 p-4 text-left">
                  <p className="font-medium text-areia">{c.nome}</p>
                  <StatusBadge status={c.status} />
                </button>
                {campanhaExpandida === c.id && (
                  <div className="border-t border-areia/10 px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 text-xs text-areia/60 sm:grid-cols-3">
                      <span>Orçamento: {centavosParaReais(c.orcamento_centavos)}</span>
                      {typeof c.metricas?.spend === "string" && <span>Gasto (30d): R$ {c.metricas.spend}</span>}
                      {typeof c.metricas?.impressions === "string" && <span>Impressões: {c.metricas.impressions}</span>}
                      {typeof c.metricas?.reach === "string" && <span>Alcance: {c.metricas.reach}</span>}
                      {typeof c.metricas?.frequency === "string" && <span>Frequência: {c.metricas.frequency}</span>}
                      {typeof c.metricas?.clicks === "string" && <span>Cliques: {c.metricas.clicks}</span>}
                      {typeof c.metricas?.ctr === "string" && <span>CTR: {c.metricas.ctr}%</span>}
                      {typeof c.metricas?.cpc === "string" && <span>CPC: R$ {c.metricas.cpc}</span>}
                      {typeof c.metricas?.cpm === "string" && <span>CPM: R$ {c.metricas.cpm}</span>}
                      {typeof c.metricas?.compras === "number" && <span>Compras: {c.metricas.compras}</span>}
                      {typeof c.metricas?.custo_por_compra === "number" && <span>CPA: {reais(c.metricas.custo_por_compra as number)}</span>}
                      {typeof c.metricas?.receita === "number" && <span>Receita: {reais(c.metricas.receita as number)}</span>}
                      {typeof c.metricas?.roas === "number" && <span>ROAS: {(c.metricas.roas as number).toFixed(2)}x</span>}
                      {typeof c.metricas?.roi === "number" && (
                        <span className={(c.metricas.roi as number) >= 0 ? "text-menta" : "text-coral"}>
                          ROI: {((c.metricas.roi as number) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] text-areia/30">
                      Drill-down por criativo agora disponível na Visão geral (ranking Top 5) — por conjunto de anúncios ainda não.
                    </p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhuma campanha registrada ainda.</p>
          )}
        </div>
      )}

      {aba === "gestor" && (
        <div className="mt-6 space-y-4">
          {!analise ? (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">
              Nenhuma análise ainda — sincronize suas campanhas na Visão geral pra gerar a primeira.
            </p>
          ) : (
            <>
              <div className="rounded-2xl panel p-4">
                <p className="mono-label text-areia/40">Resumo executivo</p>
                <p className="mt-1.5 text-sm text-areia/80">{analise.diagnostico}</p>
              </div>

              {(analise.oportunidades ?? []).length > 0 && (
                <div className="rounded-2xl border border-menta/20 bg-menta/5 p-4">
                  <p className="mono-label text-menta">Hipóteses / oportunidades</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-areia/70">
                    {(analise.oportunidades ?? []).map((o, i) => (
                      <li key={i}>• {o}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(analise.riscos ?? []).length > 0 && (
                <div className="rounded-2xl border border-coral/20 bg-coral/5 p-4">
                  <p className="mono-label text-coral">Problemas</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-areia/70">
                    {(analise.riscos ?? []).map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(analise.recomendacoes ?? []).length > 0 && (
                <div>
                  <p className="mono-label text-areia/40">Recomendações priorizadas</p>
                  <div className="mt-2 space-y-2">
                    {(analise.recomendacoes ?? []).map((r, i) => (
                      <div key={i} className="rounded-xl panel p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-areia">{r.titulo}</p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${COR_CONFIANCA[r.confianca]}`}>{r.confianca}</span>
                        </div>
                        <p className="mt-1 text-xs text-areia/50">{r.impacto_esperado}</p>
                        <button
                          onClick={() => pedirAoVetor(r.tarefa)}
                          disabled={usandoDemo}
                          className="mt-2 rounded-full border border-ambar/30 px-3 py-1 text-[11px] text-ambar hover:bg-ambar/10 disabled:opacity-30"
                        >
                          Pedir ao Vetor para executar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-areia/50">
            Qualquer alteração real de orçamento, publicação ou pausa passa pela aprovação normal do Vetor — peça pelo{" "}
            <Link href="/vetor" className="text-menta underline underline-offset-2">
              chat principal
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
