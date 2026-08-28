import Anthropic from "@anthropic-ai/sdk";
import { montarPromptDeFundo } from "./designLayout.js";
import { gerarImagem } from "../integrations/imageProvider.js";
import { tamanhoOpenAI } from "../integrations/imageProvider.js";
import { dimensaoDoTamanhoOpenAI, lerDimensaoDeImagem } from "./designProjects.js";
import { montarLayoutPorDirecao, ESTILOS_ARTE_DIRECAO, type EstiloArteDirecao, type AtivoDeImagemLayout, type LogoParaLayout } from "./artDirection.js";
import { renderizarPecaComposta, amostrarLuminanciaMedia } from "./designComposer.js";
import { buscarLogoParaFormato, validarAtivoParaUso, buscarAtivoPorId, baixarBytesDoAtivo } from "./businessAssets.js";
import { buscarBrandKit, mapearFormatoParaLogo, resolverFonteDoBrandKit, resolverCorPrimariaDoBrandKit } from "./brandKitResolver.js";
import type { EspecificacaoDeCamada } from "./designLayout.js";

// Achado ao vivo: a suíte de IA "estúdio direto" (canvas/ /imagem, sem
// missão/aprovação) gerava a peça pedindo pro MODELO DE IMAGEM desenhar o
// texto direto nos pixels — exatamente o que o pipeline de missão
// (criar_peca_de_design, ver agents/specialistRunner.ts) já tinha resolvido
// há tempo: fundo gerado SEM nenhum texto + headline/subheadline/cta/
// caption como camadas de texto REAIS (fonte de verdade, sharp+Pango,
// nunca pixel alucinado pela IA de imagem). Este módulo é esse MESMO
// pipeline de composição, só que sem a parte específica de missão
// (mission_step/design_project/DesignCritic) — usado pelo ImageAdapter
// (geração direta) e reaproveitado pelo agente de Design via
// specialistRunner.ts, nunca duas versões divergentes de "como montar uma
// peça de verdade".

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface CamposDePeca {
  visualPrompt: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  caption?: string;
  estiloVisual?: EstiloArteDirecao;
}

const EXTRAIR_CAMPOS_TOOL: Anthropic.Tool = {
  name: "campos_da_peca",
  description:
    "Decompõe o pedido em campos separados pra uma peça de design real: o tratamento visual de fundo/cena " +
    "(nunca texto) e os textos que viram camadas reais. A logo oficial é aplicada automaticamente pelo sistema " +
    "sempre que o cliente tem uma cadastrada — se o pedido mencionar 'logo', 'marca no rodapé' ou algo do tipo, " +
    "é só confirmação do que já vai acontecer sozinho: NUNCA repita essa instrução em nenhum campo de texto " +
    "abaixo (headline/subheadline/cta/caption) — isso viraria a FRASE 'logo aqui' escrita na peça, em vez da " +
    "logo de verdade. Frase sobre a logo sem nenhum outro conteúdo de texto = todos os campos de texto vazios.",
  input_schema: {
    type: "object",
    properties: {
      visual_prompt: {
        type: "string",
        description:
          "Descrição SÓ do tratamento visual de fundo/cena: composição, cores, iluminação, estilo, ambiente. " +
          "NUNCA mencione texto, número, preço, CTA ou logotipo aqui — isso vai nos campos separados abaixo.",
      },
      headline: { type: "string", description: "Mensagem principal e curta da peça (2-6 palavras), se o pedido tiver uma. Nunca instrução sobre logo/marca." },
      subheadline: { type: "string", description: "Informação de apoio curta, se houver. Nunca instrução sobre logo/marca." },
      cta: { type: "string", description: "Chamada pra ação curta, se houver (ex: 'Peça já pelo WhatsApp'). Nunca instrução sobre logo/marca." },
      caption: { type: "string", description: "Selo/legenda curta adicional, se houver (ex: 'Só hoje', preço). Nunca instrução sobre logo/marca." },
      estilo_visual: {
        type: "string",
        enum: ESTILOS_ARTE_DIRECAO as unknown as string[],
        description:
          "Direção de arte que melhor serve o pedido. product_hero pra produto em destaque absoluto; " +
          "split_screen pra comparação; collage com 2+ ativos reais pra combinar; testimonial pra depoimento; " +
          "minimal_authority pra marca premium com pouco texto; editorial (padrão) pra oferta com headline forte.",
      },
    },
    required: ["visual_prompt"],
  },
};

// Único uso de IA nesta função pra DECIDIR o que vai em cada campo de
// texto — o desenho do texto em si nunca é feito pela IA (isso é
// renderizarPecaComposta, fonte real). Fail-closed honesto: se a chamada
// falhar, o pedido inteiro vira visual_prompt (a peça sai só com fundo,
// sem texto quebrado/alucinado por cima).
export async function extrairCamposDePeca(promptLivre: string): Promise<CamposDePeca> {
  try {
    const resposta = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      tools: [EXTRAIR_CAMPOS_TOOL],
      tool_choice: { type: "tool", name: "campos_da_peca" },
      messages: [{ role: "user", content: promptLivre }],
    });
    const bloco = resposta.content.find((b) => b.type === "tool_use");
    if (!bloco || bloco.type !== "tool_use") return { visualPrompt: promptLivre };
    const input = bloco.input as Record<string, unknown>;
    const estiloPedido = typeof input.estilo_visual === "string" ? input.estilo_visual : undefined;
    return {
      visualPrompt: typeof input.visual_prompt === "string" && input.visual_prompt.trim() ? input.visual_prompt : promptLivre,
      headline: typeof input.headline === "string" && input.headline.trim() ? input.headline.trim() : undefined,
      subheadline: typeof input.subheadline === "string" && input.subheadline.trim() ? input.subheadline.trim() : undefined,
      cta: typeof input.cta === "string" && input.cta.trim() ? input.cta.trim() : undefined,
      caption: typeof input.caption === "string" && input.caption.trim() ? input.caption.trim() : undefined,
      estiloVisual: (ESTILOS_ARTE_DIRECAO as readonly string[]).includes(estiloPedido ?? "") ? (estiloPedido as EstiloArteDirecao) : undefined,
    };
  } catch {
    return { visualPrompt: promptLivre };
  }
}

function inferirFormatoParaLogo(aspectRatio: string): "feed" | "story" | "ad" {
  if (aspectRatio === "9:16") return "story";
  if (aspectRatio === "1:1") return "feed";
  return "ad";
}

export interface PecaCompostaReal {
  bytes: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
}

export async function gerarPecaCompostaReal(params: {
  clienteId: string;
  promptLivre: string;
  aspectRatio?: string;
  assetIds?: string[];
  provider?: string;
}): Promise<PecaCompostaReal> {
  const aspectRatio = params.aspectRatio ?? "1:1";
  const campos = await extrairCamposDePeca(params.promptLivre);

  // 1) Fundo — só texto-pra-imagem, nunca desenha texto (montarPromptDeFundo
  // garante isso em código).
  const promptDeFundo = montarPromptDeFundo(campos.visualPrompt);
  const imagemFundo = await gerarImagem(promptDeFundo, { aspectRatio, provider: params.provider });
  const { width, height } = lerDimensaoDeImagem(imagemFundo.bytes) ?? dimensaoDoTamanhoOpenAI(tamanhoOpenAI(aspectRatio));

  // 2) BrandKit real do cliente — fonte/cor certas, nunca genéricas.
  const brandKit = await buscarBrandKit(params.clienteId);
  const { fontFamilyTitulo, fontFamilyApoio } = resolverFonteDoBrandKit(brandKit);
  const corPrimaria = resolverCorPrimariaDoBrandKit(brandKit);
  const margem = Math.round(Math.min(width, height) * 0.07);

  // 3) Logo oficial — nunca desenhada pela IA, sempre camada travada.
  const formatoLogo = mapearFormatoParaLogo(inferirFormatoParaLogo(aspectRatio));
  const logoResolvida = await buscarLogoParaFormato(params.clienteId, formatoLogo);
  let logo: LogoParaLayout | null = null;
  if (logoResolvida) {
    const logoBytes = await baixarBytesDoAtivo(logoResolvida.id);
    const dim = logoBytes ? lerDimensaoDeImagem(logoBytes) : null;
    if (logoBytes && dim) logo = { id: logoResolvida.id, storagePath: logoResolvida.storagePath, bytes: logoBytes, naturalWidth: dim.width, naturalHeight: dim.height };
  }

  // 4) Ativos reais do Drive (produto/pessoa) pedidos — nunca image-to-image,
  // sempre camada de imagem própria.
  const ativosDrive: AtivoDeImagemLayout[] = [];
  for (const assetId of (params.assetIds ?? []).slice(0, 2)) {
    if (logo && assetId === logo.id) continue;
    const validacao = await validarAtivoParaUso(params.clienteId, assetId);
    if (!validacao.valido) continue;
    const ativo = await buscarAtivoPorId(assetId);
    const bytes = ativo ? await baixarBytesDoAtivo(assetId) : null;
    if (!ativo || !bytes) continue;
    const dim = ativo.width && ativo.height ? { width: ativo.width, height: ativo.height } : lerDimensaoDeImagem(bytes);
    if (!dim) continue;
    ativosDrive.push({ assetId, storagePath: ativo.storagePath, bytes, naturalWidth: dim.width, naturalHeight: dim.height, role: "produto" });
  }

  // 5) Layout real (6 direções de arte, mesma lógica de contraste-contra-
  // pixel-real-do-fundo do fluxo de missão) + composição final via sharp.
  const luminanciaGeralDoFundo = await amostrarLuminanciaMedia(imagemFundo.bytes, { x: 0, y: 0, width, height });

  const camadas: EspecificacaoDeCamada[] = [
    { tipo: "imagem", role: "fundo", source: "generated", storagePath: "", bucket: "artifacts", bytes: imagemFundo.bytes, naturalWidth: width, naturalHeight: height, x: 0, y: 0, width, height },
    ...(await montarLayoutPorDirecao(campos.estiloVisual, {
      width,
      height,
      margem,
      pathFundo: "",
      fundoBytes: imagemFundo.bytes,
      luminanciaGeralDoFundo,
      textos: { headline: campos.headline, subheadline: campos.subheadline, cta: campos.cta, caption: campos.caption },
      fontFamilyTitulo,
      fontFamilyApoio,
      corPrimaria,
      ativosDrive,
      logo,
    })),
  ];

  const bytes = await renderizarPecaComposta({ width, height, corDeFundo: "#ffffff", camadas });
  return { bytes, width, height, mimeType: "image/png" };
}
