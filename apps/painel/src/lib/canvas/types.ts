// Fase 3 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md) — Creative
// Canvas node-based. Tipos compartilhados entre o editor (client) e a
// persistência (graph_json em creative_canvas_projects, migration 0037).
// Um único tipo de node React Flow ("vetorNode"), parametrizado por `tipo`
// — evita 12 componentes quase idênticos; cada tipo só muda ícone/cor/
// campos de configuração mostrados no painel de propriedades.

export type TipoNode =
  | "briefing"
  | "arquivo"
  | "referencia"
  | "brandkit"
  | "prompt_visual"
  | "direcao_arte"
  | "provider"
  | "resultado"
  | "scene_graph"
  | "critica"
  | "aprovacao"
  | "entrega";

export type EstadoNode = "idle" | "processando" | "pronto" | "erro" | "aguardando_aprovacao" | "aprovado";

// Design V2 Fase 3 — uma missão pode gerar mais de um design_project (o
// cliente pediu variações no texto, ex: "me dá 2 opções") — o node de
// Resultado precisa mostrar TODAS, nunca só a mais recente, cada uma com
// sua própria ação (abrir/aprovar). Sem tabela nova: design_projects já
// suporta N linhas por mission_id.
export interface VariacaoResultado {
  designProjectId: string;
  thumbnailUrl: string | null;
  aspectRatio: string | null;
  resolucao: string | null;
  status: string;
}

export interface ResultadoNodeInfo {
  // Fase 3: sempre null/mock — nunca uma URL de imagem fictícia (spec:
  // "Se não houver imagem, mostrar placeholder de processamento; nunca uma
  // imagem fictícia"). Fase 4 popula com o preview real de
  // criar_peca_de_design.
  thumbnailUrl: string | null;
  aspectRatio: string | null;
  resolucao: string | null;
  provider: string | null;
  custoCentavos: number | null;
  designProjectId: string | null;
  // Fase 4 — nunca null quando mock=false: é o vínculo real com o Mission
  // Orchestrator (o canvas nunca chama criar_peca_de_design diretamente,
  // sempre passa pela mesma jornada texto->proposta->confirmação->
  // aprovação manual que o chat já usa).
  missionId: string | null;
  mock: boolean;
  // Design V2 Fase 3 — todas as saídas reais da missão (pode ter 1 ou N).
  // Sempre populado junto de thumbnailUrl/designProjectId (que continuam
  // sendo "a primeira/mais recente", pro card compacto do canvas).
  variacoes: VariacaoResultado[];
}

export interface VetorNodeData {
  tipo: TipoNode;
  titulo: string;
  descricao: string;
  estado: EstadoNode;
  erro: string | null;
  resultado?: ResultadoNodeInfo;
  // Design V2 (auditoria Gravyx) — o node de Resultado do Gravyx deixa
  // escolher formato/quantas variações ANTES de gerar, direto no node; o
  // Vetor não tinha nenhum controle equivalente (só texto livre). Sem
  // parâmetro estruturado novo no backend (CRIAR_PECA_DESIGN_TOOL já lê
  // "formato" e pedidos de variação em linguagem natural) — só dois campos
  // de configuração no node, dobrados em texto no briefing que vira o
  // pedido real (mesmo padrão de "Direção de arte preferida: X").
  formatoDesejado?: string;
  variacoesDesejadas?: number;
  [chave: string]: unknown;
}

export interface GraphNode {
  id: string;
  type: "vetorNode";
  position: { x: number; y: number };
  data: VetorNodeData;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphJson {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const RÓTULO_TIPO: Record<TipoNode, string> = {
  briefing: "Briefing",
  arquivo: "Mídia/Upload",
  referencia: "Referência",
  brandkit: "BrandKit",
  prompt_visual: "Prompt visual",
  direcao_arte: "Direção de arte",
  provider: "Provider/Modelo",
  resultado: "Variações/Resultados",
  scene_graph: "Scene Graph",
  critica: "Crítica",
  aprovacao: "Aprovação",
  entrega: "Entrega",
};

// Cor de acento por tipo — reaproveita os tokens já existentes
// (menta/electric/ambar/coral), nunca uma paleta nova solta.
export const COR_TIPO: Record<TipoNode, string> = {
  briefing: "var(--color-electric)",
  arquivo: "var(--color-menta)",
  referencia: "var(--color-menta)",
  brandkit: "var(--color-ambar)",
  prompt_visual: "var(--color-electric)",
  direcao_arte: "var(--color-electric)",
  provider: "var(--color-areia-2)",
  resultado: "var(--color-ambar)",
  scene_graph: "var(--color-ambar)",
  critica: "var(--color-coral)",
  aprovacao: "var(--color-coral)",
  entrega: "var(--color-menta)",
};

export function grafoVazio(): GraphJson {
  return { nodes: [], edges: [] };
}

let contador = 0;
export function novoIdNode(): string {
  contador += 1;
  return `node-${Date.now()}-${contador}`;
}

export function criarNode(tipo: TipoNode, posicao: { x: number; y: number }): GraphNode {
  return {
    id: novoIdNode(),
    type: "vetorNode",
    position: posicao,
    data: {
      tipo,
      titulo: RÓTULO_TIPO[tipo],
      descricao: "",
      estado: "idle",
      erro: null,
      ...(tipo === "resultado"
        ? { resultado: { thumbnailUrl: null, aspectRatio: null, resolucao: null, provider: null, custoCentavos: null, designProjectId: null, missionId: null, mock: true, variacoes: [] } }
        : {}),
    },
  };
}
