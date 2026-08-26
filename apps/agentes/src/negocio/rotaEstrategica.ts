// "Rota Estratégica" — formato de entrega de análise + plano de ação em
// seções visuais (hero com KPIs, diagnóstico, mercado, empresa, performance
// histórica, estratégia de campanhas, timeline dia a dia, checklist,
// métricas de acompanhamento), pedido explicitamente pelo cliente pra
// substituir texto corrido. Guarda-se dentro de artifacts.type="plan"
// (metadata.formato="rota_estrategica", metadata.rota=RotaEstrategica) —
// nunca precisou de tabela/migration nova, artifacts.metadata já é jsonb
// livre e o pipeline de persistência (persistirArtefato) já suporta
// metadataExtra por tipo.
//
// Disciplina inegociável: o LLM só vê números reais (ctx.trafego, já
// sincronizado do Meta Ads — ver orchestrator.ts) no prompt, nunca inventa
// os próprios; e a tabela de performance (rota.performance.linhas) é
// SOBRESCRITA no servidor com montarPerformanceLinhas(ctx.trafego.campanhas)
// antes de persistir — mesmo quando o LLM já preencheu algo lá, o valor que
// fica salvo é sempre o calculado deterministicamente, nunca o do modelo.
// estrategia/plano/checklist/metricas continuam sendo elaboração do
// especialista, fundamentada nesses números.

export interface RotaEstrategicaKpi {
  label: string;
  valor: string;
  contexto?: string;
  alerta?: boolean;
}

export interface RotaEstrategicaStat {
  label: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}

export interface RotaEstrategicaDiagnostico {
  resumo: string;
  stats: RotaEstrategicaStat[];
  porQueImporta?: string;
}

export interface RotaEstrategicaMercado {
  resumo: string;
  stats: RotaEstrategicaStat[];
}

export interface RotaEstrategicaEmpresa {
  resumo: string;
  endereco?: string;
  horarios?: string;
  canais?: string[];
}

export interface RotaEstrategicaPerformanceLinha {
  nome: string;
  objetivo?: string;
  gasto: string;
  resultados: string;
  custoResultado: string;
  leitura: string;
  status: "good" | "warn" | "critical";
}

export interface RotaEstrategicaPerformance {
  linhas: RotaEstrategicaPerformanceLinha[];
  leitura: string;
}

export interface RotaEstrategicaCampanha {
  kicker: string;
  titulo: string;
  descricao: string;
  investimentoSemana: string;
}

export interface RotaEstrategicaDia {
  numero: number;
  data: string;
  fase: string;
  totalDia: string;
  splitPorCampanha: number[];
  acoes: string[];
  climax?: boolean;
}

export interface RotaEstrategicaChecklistItem {
  titulo: string;
  descricao: string;
  critico?: boolean;
}

export interface RotaEstrategicaMetrica {
  nome: string;
  contexto: string;
  meta: string;
}

export interface RotaEstrategica {
  eyebrow: string;
  titulo: string;
  lede: string;
  kpis: RotaEstrategicaKpi[];
  diagnostico: RotaEstrategicaDiagnostico;
  mercado?: RotaEstrategicaMercado;
  empresa?: RotaEstrategicaEmpresa;
  performance?: RotaEstrategicaPerformance;
  estrategia: RotaEstrategicaCampanha[];
  plano: RotaEstrategicaDia[];
  checklist: RotaEstrategicaChecklistItem[];
  metricas: RotaEstrategicaMetrica[];
}

// Validação mínima pós tool-use: nunca persiste uma Rota sem os blocos que
// dão sustância real ao formato (diagnóstico com stats reais, timeline,
// checklist) — um "rota" capenga (só título+lede) é pior que cair de volta
// pro plano de texto simples, porque prometeria uma seção que não existe.
export function rotaEstrategicaValida(rota: Partial<RotaEstrategica> | undefined | null): rota is RotaEstrategica {
  if (!rota) return false;
  return (
    typeof rota.titulo === "string" &&
    rota.titulo.trim().length > 0 &&
    typeof rota.lede === "string" &&
    Array.isArray(rota.kpis) &&
    rota.kpis.length > 0 &&
    !!rota.diagnostico &&
    Array.isArray(rota.diagnostico.stats) &&
    Array.isArray(rota.estrategia) &&
    Array.isArray(rota.plano) &&
    Array.isArray(rota.checklist) &&
    Array.isArray(rota.metricas)
  );
}

interface CampanhaComMetricas {
  nome: string;
  metricas: { spend?: number | string; clicks?: number | string; compras?: number; ctr?: number | string } | null;
}

// Classifica cada campanha por custo/resultado relativo à média das
// campanhas com resultado real (>0) — nunca por um limiar absoluto
// inventado, já que "caro" varia por nicho/oferta. "Resultado" é compras
// quando existe (extrairCompras já soma os action_type de compra reais),
// caindo pra cliques quando a campanha não tem conversão de compra
// configurada (ex: campanha de alcance/engajamento).
export function montarPerformanceLinhas(campanhas: CampanhaComMetricas[]): RotaEstrategicaPerformanceLinha[] {
  const linhasBrutas = campanhas.map((c) => {
    const spend = Number(c.metricas?.spend ?? 0);
    const compras = Number(c.metricas?.compras ?? 0);
    const clicks = Number(c.metricas?.clicks ?? 0);
    const resultado = compras > 0 ? compras : clicks;
    const objetivo = compras > 0 ? "Compras" : "Cliques";
    const custoPorResultado = resultado > 0 ? spend / resultado : null;
    return { nome: c.nome, spend, resultado, objetivo, custoPorResultado };
  });

  const comResultado = linhasBrutas.filter((l) => l.custoPorResultado !== null);
  const media = comResultado.length > 0 ? comResultado.reduce((soma, l) => soma + (l.custoPorResultado as number), 0) / comResultado.length : null;

  return linhasBrutas.map((l): RotaEstrategicaPerformanceLinha => {
    let status: "good" | "warn" | "critical" = "critical";
    let leitura = "Sem resultado registrado no período.";
    if (l.custoPorResultado !== null && media !== null) {
      if (l.custoPorResultado <= media * 0.75) {
        status = "good";
        leitura = "Abaixo da média da conta.";
      } else if (l.custoPorResultado <= media * 1.5) {
        status = "warn";
        leitura = "Na média da conta.";
      } else {
        status = "critical";
        leitura = "Bem acima da média da conta — candidata a pausa.";
      }
    }
    return {
      nome: l.nome,
      objetivo: l.objetivo,
      gasto: `R$ ${l.spend.toFixed(2)}`,
      resultados: String(l.resultado),
      custoResultado: l.custoPorResultado !== null ? `R$ ${l.custoPorResultado.toFixed(2)}` : "—",
      leitura,
      status,
    };
  });
}

// Fragmento de JSON Schema pro campo opcional `rota` nas ferramentas
// entregar_resultado/entregar_documento (specialistRunner.ts) — só
// preenchido quando a etapa pede uma Rota Estratégica de verdade (análise +
// plano de ação em formato de relatório executivo), nunca pra plano/
// calendário simples. Colocado aqui (não duplicado nas duas ferramentas)
// porque as duas precisam do mesmo shape exato.
const STAT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    valor: { type: "string" },
    nota: { type: "string" },
    alerta: { type: "boolean" },
  },
  required: ["label", "valor"],
};

export const ROTA_ESTRATEGICA_SCHEMA = {
  type: "object",
  description:
    "Preencha SÓ quando a etapa pede uma Rota Estratégica completa (análise + plano de ação em formato de relatório " +
    "executivo, com diagnóstico, mercado, timeline dia a dia etc.) — nunca para um plano/calendário simples. " +
    "kpis/diagnostico.stats/mercado.stats devem vir SÓ dos números reais fornecidos em TRÁFEGO no seu contexto — " +
    "nunca invente gasto, resultado ou métrica que não apareceu lá. A tabela de performance " +
    "(rota.performance) é recalculada automaticamente a partir do mesmo dado real depois — preencha mesmo assim com " +
    "sua melhor leitura, mas o texto de rota.performance.leitura é o que de fato importa aí. mercado/empresa podem vir " +
    "do seu conhecimento geral sobre o nicho/região quando não houver dado registrado — nesse caso deixe isso implícito " +
    "no tom (não afirme como fato exclusivo do cliente). estrategia/plano/checklist/metricas são sua elaboração " +
    "estratégica real, fundamentada nos números do contexto.",
  properties: {
    eyebrow: { type: "string", description: "Rótulo curto acima do título, ex: 'Meta Ads · Nome do Cliente'." },
    titulo: { type: "string" },
    lede: { type: "string", description: "1-2 frases resumindo o objetivo do plano, pode ter trechos que merecem destaque." },
    kpis: {
      type: "array",
      description: "3-4 números centrais do topo (ex: teto diário, investido na semana, campanhas ativas).",
      items: STAT_ITEM_SCHEMA,
    },
    diagnostico: {
      type: "object",
      properties: {
        resumo: { type: "string" },
        stats: { type: "array", items: STAT_ITEM_SCHEMA },
        porQueImporta: { type: "string", description: "Por que este diagnóstico importa pra decisão — opcional." },
      },
      required: ["resumo", "stats"],
    },
    mercado: {
      type: "object",
      properties: {
        resumo: { type: "string" },
        stats: { type: "array", items: STAT_ITEM_SCHEMA },
      },
    },
    empresa: {
      type: "object",
      properties: {
        resumo: { type: "string" },
        endereco: { type: "string" },
        horarios: { type: "string" },
        canais: { type: "array", items: { type: "string" } },
      },
    },
    performance: {
      type: "object",
      properties: {
        linhas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              objetivo: { type: "string" },
              gasto: { type: "string" },
              resultados: { type: "string" },
              custoResultado: { type: "string" },
              leitura: { type: "string" },
              status: { type: "string", enum: ["good", "warn", "critical"] },
            },
            required: ["nome", "gasto", "resultados", "custoResultado", "leitura", "status"],
          },
        },
        leitura: { type: "string", description: "Parágrafo de leitura geral da tabela de performance." },
      },
    },
    estrategia: {
      type: "array",
      description: "As campanhas/frentes propostas pra este período (2 a N).",
      items: {
        type: "object",
        properties: {
          kicker: { type: "string", description: "Ex: 'CAMPANHA A · TESTE NOVO'." },
          titulo: { type: "string" },
          descricao: { type: "string" },
          investimentoSemana: { type: "string", description: "Ex: 'R$ 470'." },
        },
        required: ["kicker", "titulo", "descricao", "investimentoSemana"],
      },
    },
    plano: {
      type: "array",
      description: "Timeline dia a dia — um item por dia do período do plano.",
      items: {
        type: "object",
        properties: {
          numero: { type: "number" },
          data: { type: "string", description: "Ex: 'Terça, 25/08'." },
          fase: { type: "string", description: "Ex: 'Ativação', 'Escala', 'Fechamento'." },
          totalDia: { type: "string", description: "Ex: 'R$ 200'." },
          splitPorCampanha: {
            type: "array",
            items: { type: "number" },
            description: "Proporção de orçamento por campanha nesse dia (mesma ordem de `estrategia`), somando 100.",
          },
          acoes: { type: "array", items: { type: "string" } },
          climax: { type: "boolean", description: "true só no último dia/dia decisivo do plano." },
        },
        required: ["numero", "data", "fase", "totalDia", "splitPorCampanha", "acoes"],
      },
    },
    checklist: {
      type: "array",
      description: "Itens pra confirmar antes de publicar.",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          critico: { type: "boolean" },
        },
        required: ["titulo", "descricao"],
      },
    },
    metricas: {
      type: "array",
      description: "Métricas de acompanhamento com meta-alvo.",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          contexto: { type: "string" },
          meta: { type: "string" },
        },
        required: ["nome", "contexto", "meta"],
      },
    },
  },
  required: ["titulo", "lede", "kpis", "diagnostico", "estrategia", "plano", "checklist", "metricas"],
} as const;

