// Design profissional V1 (camadas reais) — funções puras de layout/validação
// usadas pela nova ferramenta `criar_peca_de_design`. Nunca tocam rede/DB;
// tudo que decide "isso está certo?" fica aqui, testável sem provider nem
// Supabase (mesma convenção do resto do repo).

export type FormatoPeca = "feed" | "story" | "reels_cover" | "ad" | "custom";

// Deriva o aspect ratio real a partir do formato pedido — "custom"/"ad"
// exigem aspectRatio explícito porque não têm uma proporção única óbvia;
// os demais têm proporção padrão de mercado (nunca inventa uma pra
// "custom" sem o cliente pedir).
export function mapearFormatoParaAspectRatio(formato: FormatoPeca, aspectRatioExplicito?: string): string {
  if (formato === "feed") return "1:1";
  if (formato === "story" || formato === "reels_cover") return "9:16";
  if (formato === "ad") return aspectRatioExplicito ?? "4:5";
  if (!aspectRatioExplicito) {
    throw new Error('formato "custom" exige aspect_ratio explícito.');
  }
  return aspectRatioExplicito;
}

// Reforço de qualidade fotográfica/cinematográfica — sempre aplicado em
// código, nunca depende do agente (Claude, via prompts/design.md) lembrar
// de escrever isso bem toda vez. Achado ao vivo: o `visual_prompt` do
// agente costuma descrever CENA (o quê) mas raramente direção de arte real
// (COMO fotografar) — sem isso, o modelo de imagem tende a um resultado
// plano/genérico tipo banco de imagens datado, mesmo com uma boa descrição
// de conteúdo. Mesmo princípio de produto que ferramentas comerciais de
// geração (ex: refino automático de prompt com direção de câmera/luz antes
// de gerar) — aqui é feito uma vez, em código, pra valer em toda peça.
const PADRAO_QUALIDADE_FOTOGRAFICA =
  "DIREÇÃO DE ARTE (aplique sempre, além da cena descrita acima): trate isto como uma fotografia " +
  "publicitária profissional de agência premium, não uma ilustração ou render genérico. Iluminação " +
  "intencional e controlada (luz de estúdio motivada ou luz natural de horário dourado — nunca flash " +
  "direto achatado nem luz de teto genérica). Profundidade de campo real: sujeito principal nítido, " +
  "fundo com leve desfoque óptico quando a composição pedir. Enquadramento com hierarquia visual clara " +
  "(regra dos terços ou centralização deliberada — nunca um enquadramento acidental). Cores com grading " +
  "coerente e contido (paleta consistente, sem saturação artificial nem contraste estourado). Textura e " +
  "nitidez de sensor de câmera profissional full-frame, close o suficiente para mostrar detalhe e " +
  "textura real do assunto. Evite explicitamente: aparência de banco de imagens genérico/datado, " +
  "composição centralizada sem intenção, iluminação chapada, plástico/render 3D artificial, ruído ou " +
  "borrão de baixa qualidade.";

// Achado ao vivo (peça real gerada em produção): o agente às vezes descreve
// uma cor do jeito mais preciso que conhece — o código hex (#FF6B35) — e o
// modelo de imagem literalmente desenha esse código como texto na peça
// (o mesmo problema que a RESTRIÇÃO OBRIGATÓRIA abaixo já tenta evitar pra
// texto em geral, mas um código hex não "parece" texto pro agente escrever,
// então passa despercebido). Nunca confia só na instrução — remove o
// padrão em código antes de montar o prompt, trocando por uma descrição em
// palavras que carrega a mesma intenção sem virar tipografia literal.
const PADRAO_HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function removerCodigosHexDoPrompt(visualPrompt: string): string {
  if (!PADRAO_HEX.test(visualPrompt)) return visualPrompt;
  PADRAO_HEX.lastIndex = 0;
  return visualPrompt.replace(PADRAO_HEX, "").replace(/\(\s*\)/g, "").replace(/ {2,}/g, " ");
}

// Constrói o prompt REAL enviado ao provider de imagem a partir do que o
// agente descreveu — sempre acrescenta a restrição de "nunca desenhar
// texto/logo" em código, nunca confia só na instrução do prompt do agente
// (defesa em profundidade: o modelo de imagem já demonstrou, em versões
// anteriores do Design, que desenha texto quando o prompt menciona texto
// mesmo sem pedir explicitamente).
export function montarPromptDeFundo(visualPrompt: string): string {
  const restricao =
    "RESTRIÇÃO OBRIGATÓRIA: gere APENAS o tratamento visual de fundo/cena/textura — nunca inclua texto, " +
    "letras, números, palavras, frases, legendas, logotipos, marcas d'água ou qualquer tipografia legível " +
    "na imagem. Deixe espaço negativo adequado pra sobrepor texto depois, coerente com a composição " +
    "descrita. Ignore qualquer menção a texto específico no pedido abaixo — texto nunca é desenhado nesta " +
    "etapa, é sempre composto depois como camada separada. Isso vale também para qualquer código de cor " +
    "hexadecimal (ex: #RRGGBB) que apareça na descrição abaixo — NUNCA desenhe o código em si como texto " +
    "na imagem, use-o só como referência interna da cor pretendida.";
  const promptSemHex = removerCodigosHexDoPrompt(visualPrompt.trim());
  return `${promptSemHex}\n\n${restricao}\n\n${PADRAO_QUALIDADE_FOTOGRAFICA}`;
}

// Termos que indicam que o modelo (ou um valor vindo do briefing) não
// preencheu o campo de verdade — nunca persiste isso como se fosse copy
// real. Comparação normalizada (minúsculo, sem acento) pra pegar variações
// óbvias sem virar uma lista infinita de casos.
const MARCADORES_DE_PLACEHOLDER = [
  "lorem ipsum",
  "insira texto",
  "insira o texto",
  "seu texto aqui",
  "texto aqui",
  "placeholder",
  "[cta]",
  "[headline]",
  "[texto]",
  "digite aqui",
  "exemplo de texto",
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectarPlaceholder(texto: string): boolean {
  const normalizado = normalizar(texto.trim());
  if (!normalizado) return false;
  return MARCADORES_DE_PLACEHOLDER.some((marcador) => normalizado.includes(marcador));
}

export interface CaixaDelimitadora {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Área segura: nenhum elemento de texto/CTA pode invadir a margem — mesmo
// raciocínio de "safe area" de vídeo vertical (Stories/Reels cortam bordas
// em alguns players/telas). margemPercentual é sobre a MENOR dimensão do
// canvas, pra manter a margem proporcional em peças muito largas/altas.
export function validarAreaSegura(caixa: CaixaDelimitadora, canvasWidth: number, canvasHeight: number, margemPercentual = 0.06): boolean {
  const margem = Math.round(Math.min(canvasWidth, canvasHeight) * margemPercentual);
  return (
    caixa.x >= margem &&
    caixa.y >= margem &&
    caixa.x + caixa.width <= canvasWidth - margem &&
    caixa.y + caixa.height <= canvasHeight - margem
  );
}

// Luminância relativa (WCAG 2.x) de uma cor sRGB 0-255 por canal — base
// tanto pra amostra de pixel real do fundo (designComposer.ts) quanto pra
// cor de texto declarada em hex.
export function luminanciaRelativaRGB(r: number, g: number, b: number): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function luminanciaRelativaHex(hex: string): number {
  const limpo = hex.replace("#", "");
  const completo = limpo.length === 3 ? limpo.split("").map((c) => c + c).join("") : limpo;
  const r = parseInt(completo.slice(0, 2), 16) || 0;
  const g = parseInt(completo.slice(2, 4), 16) || 0;
  const b = parseInt(completo.slice(4, 6), 16) || 0;
  return luminanciaRelativaRGB(r, g, b);
}

// Contraste WCAG entre duas luminâncias relativas (0–1) — >=4.5 é o mínimo
// pra texto normal legível (WCAG AA), usado como piso pra reprovar texto
// ilegível sobre o fundo real (nunca só "parece que dá pra ler").
export function calcularContraste(luminanciaA: number, luminanciaB: number): number {
  const claro = Math.max(luminanciaA, luminanciaB);
  const escuro = Math.min(luminanciaA, luminanciaB);
  return (claro + 0.05) / (escuro + 0.05);
}

export const CONTRASTE_MINIMO_LEGIVEL = 4.5;

// Cor de texto padrão quando o BrandKit não define uma — decide preto ou
// branco a partir da luminância REAL do fundo amostrado (nunca um preto
// fixo que ficaria ilegível sobre fundo escuro). Usado só como fallback;
// se o BrandKit define uma cor, ela é respeitada e ainda assim validada
// pelo contraste acima.
export function corDeTextoPadrao(luminanciaDoFundo: number): string {
  return luminanciaDoFundo < 0.5 ? "#ffffff" : "#151515";
}

// Especificação CANÔNICA de camada — uma lista destas é montada UMA vez
// pelo executor da ferramenta (specialistRunner.ts) e alimenta os dois
// lugares que precisam concordar byte a byte: o renderizador real
// (designComposer.ts, produz o PNG de preview) e o Fabric JSON persistido
// (designProjects.ts, o que o editor carrega). Nunca existem duas fontes
// de verdade de posição/tamanho/texto — é o mesmo array pros dois.
export interface EspecificacaoImagem {
  tipo: "imagem";
  role: "fundo" | "produto" | "pessoa" | "elemento";
  source: "generated" | "drive";
  assetId?: string;
  storagePath: string;
  bucket: "artifacts" | "brand-assets";
  // Bytes reais só são usados pelo renderizador (designComposer.ts) — o
  // Fabric JSON nunca embute bytes, só o storagePath.
  bytes: Buffer;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EspecificacaoTexto {
  tipo: "texto";
  field: "headline" | "subheadline" | "cta" | "caption";
  texto: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fill: string;
  textAlign: "left" | "center" | "right";
  // true quando o briefing exigia este campo — usado tanto pra validar
  // "nenhum texto obrigatório vazio" quanto pros critérios estruturais do
  // DesignCritic (ver designCritic.ts).
  required: boolean;
}

export interface EspecificacaoForma {
  tipo: "forma";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  raioCanto: number;
}

export interface EspecificacaoLogo {
  tipo: "logo";
  assetId: string;
  storagePath: string;
  bucket: "brand-assets";
  bytes: Buffer;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EspecificacaoDeCamada = EspecificacaoImagem | EspecificacaoTexto | EspecificacaoForma | EspecificacaoLogo;

// Estimativa de altura de um bloco de texto — heurística (largura média de
// caractere ~0.62×fontSize pra uma fonte sans genérica em negrito/caixa
// alta, o caso mais comum em headline/CTA de marketing), nunca pixel-
// perfeito. Usada só pra POSICIONAR camadas sem sobrepor umas às outras
// (layout determinístico), não pra decidir aprovação — o contraste/área
// segura reais são checados sobre a posição final já decidida.
//
// Achado em teste real de produção: com 0.55 a estimativa previu 1 linha
// pra um headline bold que na verdade quebrou em 2 no Fabric/browser
// (larguras de caractere reais em negrito/maiúsculas são mais largas que a
// média de uma fonte regular) — o subheadline seguinte ficou colado/
// sobreposto na 2ª linha real. Bug de contraste é sempre pior que um
// respiro extra: o multiplicador subiu pra superestimar de propósito
// (melhor um espaço a mais do que texto ilegível).
export function estimarAlturaDeTexto(texto: string, larguraDisponivel: number, fontSize: number): number {
  const larguraMediaCaractere = fontSize * 0.62;
  const caracteresPorLinha = Math.max(1, Math.floor(larguraDisponivel / larguraMediaCaractere));
  const linhas = Math.max(1, Math.ceil(texto.length / caracteresPorLinha));
  const alturaDeLinha = fontSize * 1.3;
  return Math.round(linhas * alturaDeLinha);
}
