// Design V2 Fase 2 — as 8 receitas visuais de agência pedidas no prompt.
// Curadas pelo Vetor, não linhas em design_flows (essa tabela é só pros
// templates que o PRÓPRIO cliente salva — cliente_id not null, sem conceito
// de "global" no schema, ver 0031_design_flows.sql). Mesmo padrão de
// conteúdo curado já usado em ReferenciasPainel.tsx (categorias fixas em
// código). Cada receita monta os MESMOS query params que TemplatesPainel.
// usarTemplate() já usa — abre /design com o wizard pré-preenchido, nunca
// um caminho de geração paralelo.
export interface ReceitaAgencia {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  formato: string;
  tom: string;
  estiloVisual: "editorial" | "product_hero" | "split_screen" | "collage" | "testimonial" | "minimal_authority";
}

export const RECEITAS_AGENCIA: ReceitaAgencia[] = [
  {
    id: "post-oferta",
    nome: "Post de oferta",
    descricao: "Promoção com urgência e CTA claro.",
    objetivo: "Divulgar uma oferta com urgência e um CTA claro de compra",
    formato: "Feed",
    tom: "Direto e urgente",
    estiloVisual: "product_hero",
  },
  {
    id: "carrossel-educativo",
    nome: "Carrossel educativo",
    descricao: "Ensina algo em sequência de cards.",
    objetivo: "Ensinar algo do jeito da marca, em sequência de cards no carrossel",
    formato: "Carrossel",
    tom: "Didático",
    estiloVisual: "editorial",
  },
  {
    id: "story-cta",
    nome: "Story com CTA",
    descricao: "Chamada rápida pra ação em Stories.",
    objetivo: "Chamar pra uma ação rápida (link, DM, WhatsApp) em formato Story",
    formato: "Story",
    tom: "Direto",
    estiloVisual: "minimal_authority",
  },
  {
    id: "product-hero",
    nome: "Product Hero",
    descricao: "O produto como protagonista da peça.",
    objetivo: "Destacar um produto específico como protagonista visual",
    formato: "Feed",
    tom: "Premium",
    estiloVisual: "product_hero",
  },
  {
    id: "depoimento",
    nome: "Depoimento",
    descricao: "Prova social de um cliente real.",
    objetivo: "Compartilhar um depoimento real de cliente como prova social",
    formato: "Feed",
    tom: "Autêntico",
    estiloVisual: "testimonial",
  },
  {
    id: "lancamento",
    nome: "Lançamento",
    descricao: "Anúncio de algo novo.",
    objetivo: "Anunciar o lançamento de algo novo com energia",
    formato: "Feed",
    tom: "Empolgante",
    estiloVisual: "collage",
  },
  {
    id: "capa-reel",
    nome: "Capa de Reel",
    descricao: "Capa chamativa pra um vídeo curto.",
    objetivo: "Criar a capa de um Reel/vídeo curto, chamativa o suficiente pra gerar clique",
    formato: "Capa de Reel",
    tom: "Dinâmico",
    estiloVisual: "split_screen",
  },
  {
    id: "identidade-visual",
    nome: "Identidade Visual",
    descricao: "Reforça a marca sem promoção específica.",
    objetivo: "Reforçar a identidade visual da marca, sem promover uma oferta específica",
    formato: "Feed",
    tom: "Institucional",
    estiloVisual: "minimal_authority",
  },
];

export function queryDaReceita(receita: ReceitaAgencia): string {
  const params = new URLSearchParams({
    template: receita.nome,
    objetivo: receita.objetivo,
    formato: receita.formato,
    tom: receita.tom,
    estiloVisual: receita.estiloVisual,
  });
  return params.toString();
}
