import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { descriptografarToken } from "../security/tokenCrypto.js";
import { graphApiUrl } from "./providers.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sincronização real de campanhas + métricas do Meta Ads (Tráfego →
// Dashboard). Nunca inventa dado: se não há conexão conectada, retorna
// nao_conectado explicitamente — o chamador (rota/página) decide como
// mostrar isso, nunca preenche com número fictício.

export class ContaDeAnuncioNaoConectadaError extends Error {}

interface CampanhaGraph {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface InsightGraph {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

// Campos completos pedidos à Graph API pra alimentar o dashboard "todas as
// métricas do Facebook Ads" — frequency/action_values/cost_per_action_type/
// purchase_roas são os que faltavam pra calcular CPA, receita, ROAS e ROI
// reais (antes só vinha o básico de gasto/alcance/cliques).
const CAMPOS_INSIGHTS =
  "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";

interface AdGraph {
  id: string;
  name: string;
  creative?: { thumbnail_url?: string };
}

// Meta usa vários action_type pra "compra" dependendo do evento configurado
// (pixel, app, offline) — soma todos os que representam checkout concluído,
// nunca inventa uma conversão que não veio da API.
const ACTION_TYPES_COMPRA = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];

export function extrairCompras(insight: InsightGraph | undefined): number {
  if (!insight?.actions) return 0;
  return insight.actions.filter((a) => ACTION_TYPES_COMPRA.includes(a.action_type)).reduce((soma, a) => soma + Number(a.value ?? 0), 0);
}

// Receita real (valor monetário das compras, não a contagem) — vem de
// action_values, o campo irmão de actions com o valor de cada conversão.
// Sem isso não dá pra calcular ROAS/ROI honestos, só CPA.
export function extrairReceita(insight: InsightGraph | undefined): number {
  if (!insight?.action_values) return 0;
  return insight.action_values.filter((a) => ACTION_TYPES_COMPRA.includes(a.action_type)).reduce((soma, a) => soma + Number(a.value ?? 0), 0);
}

// ROAS nativo do Meta quando disponível (purchase_roas — já vem calculado
// pela própria Graph API a partir do pixel/CAPI); cai pro cálculo manual
// receita/gasto só quando o campo nativo não veio (conta sem pixel de
// compra configurado, por exemplo) — nunca inventa um ROAS de 0 quando
// simplesmente não há gasto ainda (retorna null, o chamador decide como
// mostrar "sem dado" vs "zero").
export function calcularRoas(insight: InsightGraph | undefined, receita: number, gasto: number): number | null {
  const nativo = insight?.purchase_roas?.find((a) => ACTION_TYPES_COMPRA.includes(a.action_type));
  if (nativo) return Number(nativo.value);
  if (gasto <= 0) return null;
  return receita / gasto;
}

// ROI em percentual: (receita - gasto) / gasto. Sempre a partir da receita
// real (extrairReceita), nunca do ROAS nativo isolado (evita duas fontes
// de verdade divergentes pro mesmo número).
export function calcularRoi(receita: number, gasto: number): number | null {
  if (gasto <= 0) return null;
  return (receita - gasto) / gasto;
}

// Custo por compra (CPA) — usa o campo nativo cost_per_action_type quando
// disponível (mais preciso, considera atribuição da própria Meta); cai pro
// cálculo manual gasto/compras só como fallback.
export function calcularCustoPorCompra(insight: InsightGraph | undefined, gasto: number, compras: number): number | null {
  const nativo = insight?.cost_per_action_type?.find((a) => ACTION_TYPES_COMPRA.includes(a.action_type));
  if (nativo) return Number(nativo.value);
  if (compras <= 0) return null;
  return gasto / compras;
}

export function mapearStatus(statusMeta: string): string {
  // campanhas_trafego.status não tem check constraint (0001_init.sql) —
  // mantém o vocabulário livre já usado no resto do produto.
  switch (statusMeta) {
    case "ACTIVE":
      return "ativa";
    case "PAUSED":
      return "pausada";
    case "ARCHIVED":
    case "DELETED":
      return "arquivada";
    default:
      return "rascunho";
  }
}

async function tokenAtivoDoCliente(clienteId: string): Promise<{ accessToken: string; adAccountId: string } | null> {
  const { data } = await supabase
    .from("connections")
    .select("external_account_id, encrypted_access_token, status")
    .eq("cliente_id", clienteId)
    .eq("provider", "meta_ads")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.encrypted_access_token || !data.external_account_id) return null;
  return { accessToken: descriptografarToken(data.encrypted_access_token), adAccountId: data.external_account_id as string };
}

export interface ResultadoSincronizacao {
  campanhasSincronizadas: number;
  analiseId: string;
}

export interface ContextoTrafegoParaEspecialista {
  contaConectada: boolean;
  campanhas: Array<{
    nome: string;
    status: string;
    orcamentoCentavos: number | null;
    tetoCustoResultadoCentavos: number | null;
    metricas: unknown;
  }>;
  ultimaAnalise: { data: string; diagnostico: string | null; metricasUsadas: unknown } | null;
}

// Contexto real injetado no prompt do especialista de Tráfego/Analítico —
// nunca chama a Graph API aqui (isso é sincronizarTrafego, rodado à parte),
// só lê o que já foi sincronizado e persistido. Sem conexão ativa,
// contaConectada fica false e o resto vem vazio — nunca inventa dado.
export async function buscarContextoTrafego(clienteId: string): Promise<ContextoTrafegoParaEspecialista> {
  const conexao = await tokenAtivoDoCliente(clienteId);

  const { data: campanhas } = await supabase
    .from("campanhas_trafego")
    .select("nome, status, orcamento_centavos, teto_custo_resultado_centavos, metricas")
    .eq("cliente_id", clienteId)
    .order("updated_at", { ascending: false })
    .limit(20);

  const { data: analise } = await supabase
    .from("trafego_analises")
    .select("data, diagnostico, metricas_usadas")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    contaConectada: conexao !== null,
    campanhas: (campanhas ?? []).map((c) => ({
      nome: c.nome as string,
      status: c.status as string,
      orcamentoCentavos: c.orcamento_centavos as number | null,
      tetoCustoResultadoCentavos: c.teto_custo_resultado_centavos as number | null,
      metricas: c.metricas,
    })),
    ultimaAnalise: analise
      ? { data: analise.data as string, diagnostico: analise.diagnostico as string | null, metricasUsadas: analise.metricas_usadas }
      : null,
  };
}

// Fase 6 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md) — antes
// desta rodada trafego_analises.oportunidades/riscos/recomendacoes
// existiam no schema desde a migration 0016 mas nunca eram escritas por
// nenhum código (confirmado na Fase 0) — diagnostico era sempre um
// template hardcoded. Esta função é a "Análise do Gestor" de verdade:
// mesmo modelo (claude-sonnet-4-5) e mesmo padrão de tool-use já usado no
// resto do produto (ver core.ts), nunca inventando métrica — só analisa o
// que já foi sincronizado de verdade da Graph API.
interface AnaliseGestor {
  resumoExecutivo: string;
  hipoteses: string[];
  problemas: string[];
  recomendacoes: Array<{ titulo: string; impactoEsperado: string; confianca: "alta" | "media" | "baixa"; tarefa: string }>;
}

const ANALISAR_TRAFEGO_TOOL: Anthropic.Tool = {
  name: "registrar_analise_trafego",
  description: "Registra a análise executiva de tráfego pago a partir das campanhas reais sincronizadas.",
  input_schema: {
    type: "object",
    properties: {
      resumo_executivo: { type: "string", description: "2-4 frases sobre o que aconteceu nas campanhas — direto, sem jargão." },
      hipoteses: { type: "array", items: { type: "string" }, description: "Hipóteses do que está funcionando ou não, baseadas só nos números reais fornecidos." },
      problemas: { type: "array", items: { type: "string" }, description: "Problemas/riscos reais identificados (nunca inventados) — ex: CTR baixo, orçamento sem gasto, campanha pausada com verba parada." },
      recomendacoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            impacto_esperado: { type: "string", description: "Impacto esperado em termos concretos, ex: 'pode reduzir CPC em ~15%'." },
            confianca: { type: "string", enum: ["alta", "media", "baixa"] },
            tarefa: { type: "string", description: "Ação prática que o cliente pode pedir ao Vetor pra executar." },
          },
          required: ["titulo", "impacto_esperado", "confianca", "tarefa"],
        },
      },
    },
    required: ["resumo_executivo", "hipoteses", "problemas", "recomendacoes"],
  },
};

async function gerarAnaliseDoGestor(campanhas: CampanhaGraph[], metricasPorCampanha: Array<{ nome: string; insight: InsightGraph | undefined }>): Promise<AnaliseGestor | null> {
  if (campanhas.length === 0) return null;

  try {
    const resumoCampanhas = metricasPorCampanha
      .map((c) => `- ${c.nome}: gasto R$ ${c.insight?.spend ?? "0"}, impressões ${c.insight?.impressions ?? "0"}, cliques ${c.insight?.clicks ?? "0"}, CTR ${c.insight?.ctr ?? "—"}, CPC ${c.insight?.cpc ?? "—"}, CPM ${c.insight?.cpm ?? "—"}`)
      .join("\n");

    const resposta = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system:
        "Você é o Gestor de Tráfego do VETOR, analisando campanhas reais de Meta Ads de um cliente de marketing. " +
        "Nunca invente número — use só os dados fornecidos. Seja direto, prático, e priorize recomendações por impacto real.",
      messages: [{ role: "user", content: `Analise estas campanhas dos últimos 30 dias:\n${resumoCampanhas}` }],
      tools: [ANALISAR_TRAFEGO_TOOL],
      tool_choice: { type: "tool", name: "registrar_analise_trafego" },
    });

    const toolUse = resposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return null;
    const input = toolUse.input as {
      resumo_executivo: string;
      hipoteses: string[];
      problemas: string[];
      recomendacoes: Array<{ titulo: string; impacto_esperado: string; confianca: "alta" | "media" | "baixa"; tarefa: string }>;
    };

    return {
      resumoExecutivo: input.resumo_executivo,
      hipoteses: input.hipoteses ?? [],
      problemas: input.problemas ?? [],
      recomendacoes: (input.recomendacoes ?? []).map((r) => ({ titulo: r.titulo, impactoEsperado: r.impacto_esperado, confianca: r.confianca, tarefa: r.tarefa })),
    };
  } catch (err) {
    // Fail-closed honesto: se a análise por IA falhar, a sincronização de
    // campanhas (o dado real) continua valendo — só a análise fica
    // ausente, nunca fabricada como fallback.
    console.error("Falha ao gerar análise do Gestor de Tráfego:", err);
    return null;
  }
}

// Achata o insight bruto da Graph API + as métricas derivadas (receita,
// ROAS, ROI, CPA, compras) num único objeto JSONB — persistido assim tanto
// em campanhas_trafego quanto em criativos_trafego, pra o dashboard nunca
// precisar recalcular no cliente a partir do formato bruto da Meta.
function montarMetricasCompletas(insight: InsightGraph): Record<string, unknown> {
  const gasto = Number(insight.spend ?? 0);
  const compras = extrairCompras(insight);
  const receita = extrairReceita(insight);
  return {
    ...insight,
    compras,
    receita,
    roas: calcularRoas(insight, receita, gasto),
    roi: calcularRoi(receita, gasto),
    custo_por_compra: calcularCustoPorCompra(insight, gasto, compras),
  };
}

// Design V2 (auditoria Gravyx) — busca os anúncios reais de uma campanha
// (id, nome, thumbnail do criativo) + insights por anúncio, e persiste em
// criativos_trafego (migration 0039). Fail-closed silencioso: se a chamada
// falhar (permissão insuficiente do token, por exemplo), a campanha
// continua sincronizada normalmente — só os criativos daquela campanha
// ficam ausentes, nunca inventados.
async function sincronizarCriativosDaCampanha(clienteId: string, campanhaId: string, metaCampaignId: string, accessToken: string): Promise<void> {
  try {
    const resAds = await fetch(
      graphApiUrl(`/${metaCampaignId}/ads?fields=id,name,creative{thumbnail_url}&limit=20`) + `&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!resAds.ok) return;
    const anuncios = ((await resAds.json()) as { data: AdGraph[] }).data ?? [];

    for (const anuncio of anuncios) {
      const resInsights = await fetch(
        graphApiUrl(`/${anuncio.id}/insights?fields=${CAMPOS_INSIGHTS}&date_preset=last_30d`) +
          `&access_token=${encodeURIComponent(accessToken)}`,
      );
      const insightsBody = resInsights.ok ? ((await resInsights.json()) as { data: InsightGraph[] }) : { data: [] };
      const insight = insightsBody.data?.[0];

      await supabase.from("criativos_trafego").upsert(
        {
          cliente_id: clienteId,
          campanha_id: campanhaId,
          meta_ad_id: anuncio.id,
          nome: anuncio.name,
          thumbnail_url: anuncio.creative?.thumbnail_url ?? null,
          metricas: insight ? montarMetricasCompletas(insight) : {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "meta_ad_id" },
      );
    }
  } catch (err) {
    console.error(`Falha ao sincronizar criativos da campanha ${metaCampaignId}:`, err);
  }
}

export async function sincronizarTrafego(clienteId: string): Promise<ResultadoSincronizacao> {
  const conexao = await tokenAtivoDoCliente(clienteId);
  if (!conexao) throw new ContaDeAnuncioNaoConectadaError("Nenhuma conta de anúncios Meta conectada.");

  const resCampanhas = await fetch(
    graphApiUrl(`/${conexao.adAccountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&limit=50`) +
      `&access_token=${encodeURIComponent(conexao.accessToken)}`,
  );
  if (!resCampanhas.ok) {
    throw new Error(`Falha ao buscar campanhas no Meta Ads: ${resCampanhas.status} ${await resCampanhas.text()}`);
  }
  const campanhas = ((await resCampanhas.json()) as { data: CampanhaGraph[] }).data ?? [];

  let sincronizadas = 0;
  const metricasAgregadas = { spend: 0, impressions: 0, reach: 0, clicks: 0, compras: 0, receita: 0 };
  const metricasPorCampanha: Array<{ nome: string; insight: InsightGraph | undefined }> = [];

  for (const campanha of campanhas) {
    const resInsights = await fetch(
      graphApiUrl(`/${campanha.id}/insights?fields=${CAMPOS_INSIGHTS}&date_preset=last_30d`) +
        `&access_token=${encodeURIComponent(conexao.accessToken)}`,
    );
    const insightsBody = resInsights.ok ? ((await resInsights.json()) as { data: InsightGraph[] }) : { data: [] };
    const insight = insightsBody.data?.[0];
    metricasPorCampanha.push({ nome: campanha.name, insight });

    if (insight) {
      metricasAgregadas.spend += Number(insight.spend ?? 0);
      metricasAgregadas.impressions += Number(insight.impressions ?? 0);
      metricasAgregadas.reach += Number(insight.reach ?? 0);
      metricasAgregadas.clicks += Number(insight.clicks ?? 0);
      metricasAgregadas.compras += extrairCompras(insight);
      metricasAgregadas.receita += extrairReceita(insight);
    }

    const orcamentoCentavos = campanha.daily_budget
      ? Number(campanha.daily_budget)
      : campanha.lifetime_budget
        ? Number(campanha.lifetime_budget)
        : null;

    const { data: campanhaSalva, error } = await supabase
      .from("campanhas_trafego")
      .upsert(
        {
          cliente_id: clienteId,
          meta_campaign_id: campanha.id,
          nome: campanha.name,
          status: mapearStatus(campanha.status),
          orcamento_centavos: orcamentoCentavos,
          metricas: insight ? montarMetricasCompletas(insight) : {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "meta_campaign_id" },
      )
      .select("id")
      .single();
    if (!error) sincronizadas++;

    // Design V2 (auditoria Gravyx) — nível de anúncio/criativo, pra
    // alimentar o ranking "Top criativos por métrica" real (antes só havia
    // dado no nível de campanha). Uma chamada extra por campanha — mesma
    // conta de anúncio, mesmo token, nunca um provider novo.
    if (campanhaSalva) {
      await sincronizarCriativosDaCampanha(clienteId, campanhaSalva.id as string, campanha.id, conexao.accessToken);
    }
  }

  const analiseGestor = await gerarAnaliseDoGestor(campanhas, metricasPorCampanha);

  const metricasUsadas = {
    ...metricasAgregadas,
    roas: metricasAgregadas.spend > 0 ? metricasAgregadas.receita / metricasAgregadas.spend : null,
    roi: metricasAgregadas.spend > 0 ? (metricasAgregadas.receita - metricasAgregadas.spend) / metricasAgregadas.spend : null,
    custo_por_compra: metricasAgregadas.compras > 0 ? metricasAgregadas.spend / metricasAgregadas.compras : null,
  };

  const { data: analise, error: erroAnalise } = await supabase
    .from("trafego_analises")
    .insert({
      cliente_id: clienteId,
      metricas_usadas: metricasUsadas,
      diagnostico:
        analiseGestor?.resumoExecutivo ??
        (campanhas.length === 0
          ? "Nenhuma campanha ativa encontrada na conta conectada."
          : `${campanhas.length} campanha(s) sincronizada(s), gasto total últimos 30 dias: R$ ${(metricasAgregadas.spend).toFixed(2)}.`),
      oportunidades: analiseGestor?.hipoteses ?? [],
      riscos: analiseGestor?.problemas ?? [],
      recomendacoes: analiseGestor?.recomendacoes ?? [],
    })
    .select("id")
    .single();

  if (erroAnalise || !analise) throw new Error(`Falha ao registrar análise de tráfego: ${erroAnalise?.message}`);

  return { campanhasSincronizadas: sincronizadas, analiseId: analise.id as string };
}
