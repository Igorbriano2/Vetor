// ArtDirectionSpec (Fase 9 do Design V2, docs/DESIGN-V2-PHASE-9-10-REPORT.md)
// — até aqui, `criar_peca_de_design` tinha UM único arranjo hardcoded
// (headline topo → imagem central → CTA canto inferior esquerdo → logo
// canto inferior direito), sempre o mesmo não importa o pedido. Este
// arquivo generaliza isso pra 6 estilos reais e distintos, cada um com
// geometria própria — nunca um rótulo cosmético sobre o mesmo layout.
//
// Contrato: cada função recebe os mesmos `ParametrosDeLayout` (já
// resolvidos pelo chamador — fundo gerado, fontes/cor do BrandKit, ativos
// do Drive, logo) e devolve `EspecificacaoDeCamada[]` — a MESMA lista
// canônica que `designComposer.ts` (PNG de preview) e `designProjects.ts`
// (Fabric JSON do editor) já consomem sem saber qual estilo a gerou. Nunca
// inclui a camada de fundo (isso continua responsabilidade do chamador,
// idêntico pros 6 estilos).
//
// `montarLayoutEditorial` é uma EXTRAÇÃO EXATA do algoritmo que já existia
// em specialistRunner.ts — mesmos multiplicadores, mesma ordem, mesmo
// resultado byte a byte. Qualquer briefing que não escolher estilo
// continua se comportando exatamente como antes desta mudança.

import { amostrarLuminanciaMedia } from "./designComposer.js";
import {
  corDeTextoPadrao,
  luminanciaRelativaHex,
  estimarAlturaDeTexto,
  type EspecificacaoDeCamada,
} from "./designLayout.js";

export type EstiloArteDirecao = "editorial" | "product_hero" | "split_screen" | "collage" | "testimonial" | "minimal_authority";

export const ESTILOS_ARTE_DIRECAO: readonly EstiloArteDirecao[] = [
  "editorial",
  "product_hero",
  "split_screen",
  "collage",
  "testimonial",
  "minimal_authority",
] as const;

export interface AtivoDeImagemLayout {
  assetId: string;
  storagePath: string;
  bytes: Buffer;
  naturalWidth: number;
  naturalHeight: number;
  role: "produto" | "pessoa" | "elemento";
}

export interface LogoParaLayout {
  id: string;
  storagePath: string;
  bytes: Buffer;
  naturalWidth: number;
  naturalHeight: number;
}

export interface ParametrosDeLayout {
  width: number;
  height: number;
  margem: number;
  pathFundo: string;
  fundoBytes: Buffer;
  luminanciaGeralDoFundo: number;
  textos: { headline?: string; subheadline?: string; cta?: string; caption?: string };
  fontFamilyTitulo: string;
  fontFamilyApoio: string;
  corPrimaria: string | null;
  ativosDrive: AtivoDeImagemLayout[];
  logo: LogoParaLayout | null;
}

// Mesma lógica em todos os 6 estilos: a cor de um bloco de texto é decidida
// pela luminância REAL da região do fundo onde ele vai cair (nunca a média
// do canvas inteiro) — achado real de produção documentado em
// specialistRunner.ts, preservado aqui.
async function corDeTextoParaRegiao(fundoBytes: Buffer, x: number, y: number, largura: number, altura: number): Promise<string> {
  const luminanciaLocal = await amostrarLuminanciaMedia(fundoBytes, { x, y, width: largura, height: altura });
  return corDeTextoPadrao(luminanciaLocal);
}

function logoParaCamada(logo: LogoParaLayout, x: number, y: number, largura: number): EspecificacaoDeCamada {
  const altura = Math.round(largura * (logo.naturalHeight / logo.naturalWidth));
  return {
    tipo: "logo",
    assetId: logo.id,
    storagePath: logo.storagePath,
    bucket: "brand-assets",
    bytes: logo.bytes,
    naturalWidth: logo.naturalWidth,
    naturalHeight: logo.naturalHeight,
    x,
    y: y - altura,
    width: largura,
    height: altura,
  };
}

// ============================================================================
// 1. EDITORIAL — extração exata do layout original (specialistRunner.ts,
//    antes desta mudança). Headline no topo, ativo do Drive centralizado,
//    CTA embaixo à esquerda com forma de contraste, logo canto inferior
//    direito. Alinhamento à esquerda o tempo todo.
// ============================================================================
async function montarLayoutEditorial(p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  const { width, height, margem, fundoBytes, luminanciaGeralDoFundo, textos, fontFamilyTitulo, fontFamilyApoio, corPrimaria, ativosDrive, logo } = p;
  const camadas: EspecificacaoDeCamada[] = [];
  let cursorY = margem;

  if (textos.caption) {
    const fontSize = Math.round(width * 0.028);
    const texto = textos.caption.trim();
    const alturaEstimada = estimarAlturaDeTexto(texto, width - margem * 2, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, cursorY, width - margem * 2, alturaEstimada);
    camadas.push({ tipo: "texto", field: "caption", texto, x: margem, y: cursorY, width: width - margem * 2, fontSize, fontFamily: fontFamilyApoio, fontWeight: "bold", fill: corPrimaria ?? corLocal, textAlign: "left", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.015);
  }

  if (textos.headline) {
    const fontSize = Math.round(width * 0.07);
    const texto = textos.headline.trim();
    const alturaEstimada = estimarAlturaDeTexto(texto, width - margem * 2, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, cursorY, width - margem * 2, alturaEstimada);
    camadas.push({ tipo: "texto", field: "headline", texto, x: margem, y: cursorY, width: width - margem * 2, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corLocal, textAlign: "left", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.015);
  }

  if (textos.subheadline) {
    const fontSize = Math.round(width * 0.038);
    const texto = textos.subheadline.trim();
    const alturaEstimada = estimarAlturaDeTexto(texto, width - margem * 2, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, cursorY, width - margem * 2, alturaEstimada);
    camadas.push({ tipo: "texto", field: "subheadline", texto, x: margem, y: cursorY, width: width - margem * 2, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corLocal, textAlign: "left", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.02);
  }

  if (ativosDrive.length > 0) {
    const primeiroAtivo = ativosDrive[0]!;
    const larguraAlvo = Math.round(width * 0.55);
    const alturaAlvo = Math.round(larguraAlvo * (primeiroAtivo.naturalHeight / primeiroAtivo.naturalWidth));
    const xAlvo = Math.round((width - larguraAlvo) / 2);
    const yAlvo = Math.max(cursorY, Math.round(height * 0.4));
    camadas.push({ tipo: "imagem", role: primeiroAtivo.role, source: "drive", assetId: primeiroAtivo.assetId, storagePath: primeiroAtivo.storagePath, bucket: "brand-assets", bytes: primeiroAtivo.bytes, naturalWidth: primeiroAtivo.naturalWidth, naturalHeight: primeiroAtivo.naturalHeight, x: xAlvo, y: yAlvo, width: larguraAlvo, height: alturaAlvo });
  }

  if (textos.cta) {
    const fontSize = Math.round(width * 0.042);
    const texto = textos.cta.trim();
    const larguraTexto = Math.min(width - margem * 2, Math.round(width * 0.6));
    const alturaTexto = estimarAlturaDeTexto(texto, larguraTexto, fontSize);
    const padding = Math.round(fontSize * 0.6);
    const yForma = height - margem - alturaTexto - padding * 2;
    const ctaCaixa = { x: margem, y: yForma, width: larguraTexto + padding * 2, height: alturaTexto + padding * 2 };
    camadas.push({ tipo: "forma", x: ctaCaixa.x, y: ctaCaixa.y, width: ctaCaixa.width, height: ctaCaixa.height, fill: corPrimaria ?? corDeTextoPadrao(luminanciaGeralDoFundo), opacity: 0.92, raioCanto: Math.round(fontSize * 0.4) });
    camadas.push({
      tipo: "texto",
      field: "cta",
      texto,
      x: ctaCaixa.x + padding,
      y: ctaCaixa.y + padding,
      width: larguraTexto,
      fontSize,
      fontFamily: fontFamilyTitulo,
      fontWeight: "bold",
      fill: corPrimaria ? corDeTextoPadrao(luminanciaRelativaHex(corPrimaria)) : corDeTextoPadrao(1 - luminanciaGeralDoFundo),
      textAlign: "left",
      required: true,
    });
  }

  if (logo) camadas.push(logoParaCamada(logo, width - Math.round(width * 0.18) - margem, height - margem, Math.round(width * 0.18)));

  return camadas;
}

// ============================================================================
// 2. PRODUCT HERO — o ativo do Drive domina 65% da altura no topo (produto
//    em destaque de verdade, não um detalhe centralizado). Faixa sólida na
//    base com headline/subheadline/CTA sobre cor conhecida (contraste
//    garantido por cálculo, não por amostragem — a faixa é opaca). Logo no
//    canto superior, fora da faixa de produto pra nunca competir com ele.
//    Sem ativo real do Drive: usa o próprio fundo gerado como "hero" (sem
//    faixa de imagem separada) — nunca finge um produto que não existe.
// ============================================================================
async function montarLayoutProductHero(p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  const { width, height, margem, textos, fontFamilyTitulo, fontFamilyApoio, corPrimaria, ativosDrive, logo, fundoBytes } = p;
  const camadas: EspecificacaoDeCamada[] = [];

  const alturaFaixa = Math.round(height * 0.34);
  const yFaixa = height - alturaFaixa;
  const corFaixa = corPrimaria ?? "#111111";
  camadas.push({ tipo: "forma", x: 0, y: yFaixa, width, height: alturaFaixa, fill: corFaixa, opacity: 1, raioCanto: 0 });
  const corTextoNaFaixa = corDeTextoPadrao(luminanciaRelativaHex(corFaixa));

  if (ativosDrive.length > 0) {
    const ativo = ativosDrive[0]!;
    const larguraAlvo = width - margem * 2;
    const alturaMax = yFaixa - margem;
    let alturaAlvo = Math.round(larguraAlvo * (ativo.naturalHeight / ativo.naturalWidth));
    let larguraFinal = larguraAlvo;
    if (alturaAlvo > alturaMax) {
      alturaAlvo = alturaMax;
      larguraFinal = Math.round(alturaAlvo * (ativo.naturalWidth / ativo.naturalHeight));
    }
    const xAlvo = Math.round((width - larguraFinal) / 2);
    const yAlvo = Math.round((yFaixa - alturaAlvo) / 2);
    camadas.push({ tipo: "imagem", role: ativo.role, source: "drive", assetId: ativo.assetId, storagePath: ativo.storagePath, bucket: "brand-assets", bytes: ativo.bytes, naturalWidth: ativo.naturalWidth, naturalHeight: ativo.naturalHeight, x: xAlvo, y: yAlvo, width: larguraFinal, height: alturaAlvo });
  }

  let cursorY = yFaixa + Math.round(alturaFaixa * 0.14);
  const larguraTextoFaixa = width - margem * 2;

  if (textos.headline) {
    const fontSize = Math.round(width * 0.065);
    const texto = textos.headline.trim();
    camadas.push({ tipo: "texto", field: "headline", texto, x: margem, y: cursorY, width: larguraTextoFaixa, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corTextoNaFaixa, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(texto, larguraTextoFaixa, fontSize) + Math.round(height * 0.012);
  }

  if (textos.subheadline) {
    const fontSize = Math.round(width * 0.032);
    const texto = textos.subheadline.trim();
    camadas.push({ tipo: "texto", field: "subheadline", texto, x: margem, y: cursorY, width: larguraTextoFaixa, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corTextoNaFaixa, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(texto, larguraTextoFaixa, fontSize) + Math.round(height * 0.015);
  }

  if (textos.cta) {
    const fontSize = Math.round(width * 0.036);
    const texto = textos.cta.trim();
    const padding = Math.round(fontSize * 0.55);
    const larguraTexto = Math.min(larguraTextoFaixa, Math.round(width * 0.5));
    const alturaTexto = estimarAlturaDeTexto(texto, larguraTexto, fontSize);
    const corBotao = corTextoNaFaixa === "#ffffff" ? "#ffffff" : "#151515";
    camadas.push({ tipo: "forma", x: margem, y: cursorY, width: larguraTexto + padding * 2, height: alturaTexto + padding * 2, fill: corBotao, opacity: 1, raioCanto: Math.round(fontSize * 0.35) });
    camadas.push({ tipo: "texto", field: "cta", texto, x: margem + padding, y: cursorY + padding, width: larguraTexto, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corDeTextoPadrao(luminanciaRelativaHex(corBotao)), textAlign: "left", required: true });
  }

  if (textos.caption) {
    const fontSize = Math.round(width * 0.024);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, margem, width - margem * 2, Math.round(fontSize * 1.3));
    camadas.push({ tipo: "texto", field: "caption", texto: textos.caption.trim(), x: margem, y: margem, width: width - margem * 2, fontSize, fontFamily: fontFamilyApoio, fontWeight: "bold", fill: corPrimaria ?? corLocal, textAlign: "left", required: true });
  }

  if (logo) camadas.push(logoParaCamada(logo, margem, margem + Math.round(width * 0.14), Math.round(width * 0.14)));

  return camadas;
}

// ============================================================================
// 3. SPLIT SCREEN — canvas dividido ao meio na vertical: painel sólido à
//    esquerda (cor da marca) com headline/subheadline/CTA/logo — contraste
//    garantido (texto sempre contra cor conhecida, nunca amostrada);
//    metade direita mostra o ativo do Drive centralizado, escalado por
//    "contain" (nunca "cover") — um ativo com proporção muito diferente da
//    região (ex: quadrado numa metade retangular alta) NUNCA deve sangrar
//    pro painel esquerdo por cima do texto; um pouco de espaço sobrando é
//    sempre preferível a invadir a área de texto. Sem ativo: metade direita
//    usa o fundo gerado normalmente.
// ============================================================================
async function montarLayoutSplitScreen(p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  const { width, height, margem, textos, fontFamilyTitulo, fontFamilyApoio, corPrimaria, ativosDrive, logo } = p;
  const camadas: EspecificacaoDeCamada[] = [];
  const larguraPainel = Math.round(width * 0.5);
  const corPainel = corPrimaria ?? "#111111";
  camadas.push({ tipo: "forma", x: 0, y: 0, width: larguraPainel, height, fill: corPainel, opacity: 1, raioCanto: 0 });
  const corTexto = corDeTextoPadrao(luminanciaRelativaHex(corPainel));

  if (ativosDrive.length > 0) {
    const ativo = ativosDrive[0]!;
    const larguraDireita = width - larguraPainel;
    // "Contain" (menor proporção), nunca "cover" — garante que a imagem
    // nunca ultrapassa os limites da metade direita, mesmo com proporções
    // muito diferentes da região (ex: ativo quadrado numa metade alta).
    const escala = Math.min(larguraDireita / ativo.naturalWidth, height / ativo.naturalHeight);
    const larguraEscalada = Math.round(ativo.naturalWidth * escala);
    const alturaEscalada = Math.round(ativo.naturalHeight * escala);
    const xImagem = larguraPainel + Math.round((larguraDireita - larguraEscalada) / 2);
    const yImagem = Math.round((height - alturaEscalada) / 2);
    camadas.push({ tipo: "imagem", role: ativo.role, source: "drive", assetId: ativo.assetId, storagePath: ativo.storagePath, bucket: "brand-assets", bytes: ativo.bytes, naturalWidth: ativo.naturalWidth, naturalHeight: ativo.naturalHeight, x: xImagem, y: yImagem, width: larguraEscalada, height: alturaEscalada });
  }

  const larguraTextoPainel = larguraPainel - margem * 2;
  let cursorY = Math.round(height * 0.12);

  if (textos.caption) {
    const fontSize = Math.round(width * 0.024);
    camadas.push({ tipo: "texto", field: "caption", texto: textos.caption.trim(), x: margem, y: cursorY, width: larguraTextoPainel, fontSize, fontFamily: fontFamilyApoio, fontWeight: "bold", fill: corTexto, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(textos.caption.trim(), larguraTextoPainel, fontSize) + Math.round(height * 0.02);
  }

  if (textos.headline) {
    const fontSize = Math.round(width * 0.058);
    const texto = textos.headline.trim();
    camadas.push({ tipo: "texto", field: "headline", texto, x: margem, y: cursorY, width: larguraTextoPainel, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corTexto, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(texto, larguraTextoPainel, fontSize) + Math.round(height * 0.02);
  }

  if (textos.subheadline) {
    const fontSize = Math.round(width * 0.03);
    const texto = textos.subheadline.trim();
    camadas.push({ tipo: "texto", field: "subheadline", texto, x: margem, y: cursorY, width: larguraTextoPainel, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corTexto, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(texto, larguraTextoPainel, fontSize) + Math.round(height * 0.025);
  }

  if (textos.cta) {
    const fontSize = Math.round(width * 0.034);
    const texto = textos.cta.trim();
    const padding = Math.round(fontSize * 0.55);
    const alturaTexto = estimarAlturaDeTexto(texto, larguraTextoPainel, fontSize);
    const corBotao = corTexto === "#ffffff" ? "#ffffff" : "#151515";
    camadas.push({ tipo: "forma", x: margem, y: cursorY, width: larguraTextoPainel, height: alturaTexto + padding * 2, fill: corBotao, opacity: 1, raioCanto: Math.round(fontSize * 0.3) });
    camadas.push({ tipo: "texto", field: "cta", texto, x: margem + padding, y: cursorY + padding, width: larguraTextoPainel - padding * 2, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corDeTextoPadrao(luminanciaRelativaHex(corBotao)), textAlign: "left", required: true });
  }

  if (logo) camadas.push(logoParaCamada(logo, margem, height - margem, Math.round(width * 0.15)));

  return camadas;
}

// ============================================================================
// 4. COLLAGE — precisa de pelo menos 2 ativos reais do Drive pra fazer
//    sentido (colagem de nada não é colagem). Sem isso, cai honestamente
//    pro layout editorial em vez de fingir uma colagem vazia — nunca
//    inventa elemento visual que não existe. Com 2 ativos: dois blocos de
//    imagem em tamanhos diferentes (assimetria proposital), texto por cima
//    de uma faixa semi-opaca pra garantir legibilidade sobre qualquer um
//    dos dois.
// ============================================================================
async function montarLayoutCollage(p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  if (p.ativosDrive.length < 2) return montarLayoutEditorial(p);

  const { width, height, margem, textos, fontFamilyTitulo, fontFamilyApoio, corPrimaria, ativosDrive, logo } = p;
  const camadas: EspecificacaoDeCamada[] = [];

  const [ativoA, ativoB] = ativosDrive as [AtivoDeImagemLayout, AtivoDeImagemLayout];
  const larguraGrande = Math.round(width * 0.62);
  const alturaGrande = Math.round(larguraGrande * (ativoA.naturalHeight / ativoA.naturalWidth));
  camadas.push({ tipo: "imagem", role: ativoA.role, source: "drive", assetId: ativoA.assetId, storagePath: ativoA.storagePath, bucket: "brand-assets", bytes: ativoA.bytes, naturalWidth: ativoA.naturalWidth, naturalHeight: ativoA.naturalHeight, x: 0, y: 0, width: larguraGrande, height: alturaGrande });

  const larguraPequena = width - larguraGrande - margem;
  const alturaPequena = Math.round(larguraPequena * (ativoB.naturalHeight / ativoB.naturalWidth));
  camadas.push({ tipo: "imagem", role: ativoB.role, source: "drive", assetId: ativoB.assetId, storagePath: ativoB.storagePath, bucket: "brand-assets", bytes: ativoB.bytes, naturalWidth: ativoB.naturalWidth, naturalHeight: ativoB.naturalHeight, x: larguraGrande + margem, y: Math.round(height * 0.06), width: larguraPequena, height: alturaPequena });

  // Faixa semi-opaca na base — legibilidade garantida sobre qualquer uma
  // das duas imagens, sem depender de amostragem de cor.
  const alturaFaixa = Math.round(height * 0.3);
  const yFaixa = height - alturaFaixa;
  const corFaixa = corPrimaria ?? "#0a0a0a";
  camadas.push({ tipo: "forma", x: 0, y: yFaixa, width, height: alturaFaixa, fill: corFaixa, opacity: 0.88, raioCanto: 0 });
  const corTexto = corDeTextoPadrao(luminanciaRelativaHex(corFaixa));

  let cursorY = yFaixa + Math.round(alturaFaixa * 0.16);
  const larguraTexto = width - margem * 2;

  if (textos.headline) {
    const fontSize = Math.round(width * 0.06);
    const texto = textos.headline.trim();
    camadas.push({ tipo: "texto", field: "headline", texto, x: margem, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corTexto, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(texto, larguraTexto, fontSize) + Math.round(height * 0.012);
  }
  if (textos.subheadline) {
    const fontSize = Math.round(width * 0.03);
    const texto = textos.subheadline.trim();
    camadas.push({ tipo: "texto", field: "subheadline", texto, x: margem, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corTexto, textAlign: "left", required: true });
    cursorY += estimarAlturaDeTexto(texto, larguraTexto, fontSize) + Math.round(height * 0.015);
  }
  if (textos.cta) {
    const fontSize = Math.round(width * 0.034);
    const texto = textos.cta.trim();
    const padding = Math.round(fontSize * 0.55);
    const larguraCta = Math.min(larguraTexto, Math.round(width * 0.5));
    const alturaTexto = estimarAlturaDeTexto(texto, larguraCta, fontSize);
    camadas.push({ tipo: "forma", x: margem, y: cursorY, width: larguraCta + padding * 2, height: alturaTexto + padding * 2, fill: corTexto, opacity: 0.95, raioCanto: Math.round(fontSize * 0.35) });
    camadas.push({ tipo: "texto", field: "cta", texto, x: margem + padding, y: cursorY + padding, width: larguraCta, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corDeTextoPadrao(luminanciaRelativaHex(corTexto)), textAlign: "left", required: true });
  }

  if (logo) camadas.push(logoParaCamada(logo, width - Math.round(width * 0.16) - margem, yFaixa - Math.round(height * 0.02), Math.round(width * 0.16)));

  return camadas;
}

// ============================================================================
// 5. TESTIMONIAL — headline tratado como citação (fonte grande, centrado),
//    ativo "pessoa" (se houver) numa moldura pequena e centralizada acima
//    da citação, subheadline como atribuição (nome/cargo) logo abaixo,
//    CTA discreto, tudo centralizado — nunca alinhado à esquerda como os
//    demais estilos (é o que diferencia visualmente um depoimento).
// ============================================================================
async function montarLayoutTestimonial(p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  const { width, height, margem, textos, fontFamilyTitulo, fontFamilyApoio, corPrimaria, ativosDrive, logo, fundoBytes } = p;
  const camadas: EspecificacaoDeCamada[] = [];
  let cursorY = Math.round(height * 0.14);

  const ativoPessoa = ativosDrive.find((a) => a.role === "pessoa") ?? ativosDrive[0];
  if (ativoPessoa) {
    const ladoFoto = Math.round(width * 0.22);
    const xFoto = Math.round((width - ladoFoto) / 2);
    const escala = Math.max(ladoFoto / ativoPessoa.naturalWidth, ladoFoto / ativoPessoa.naturalHeight);
    const larguraEscalada = Math.round(ativoPessoa.naturalWidth * escala);
    const alturaEscalada = Math.round(ativoPessoa.naturalHeight * escala);
    camadas.push({
      tipo: "imagem",
      role: ativoPessoa.role,
      source: "drive",
      assetId: ativoPessoa.assetId,
      storagePath: ativoPessoa.storagePath,
      bucket: "brand-assets",
      bytes: ativoPessoa.bytes,
      naturalWidth: ativoPessoa.naturalWidth,
      naturalHeight: ativoPessoa.naturalHeight,
      x: xFoto - Math.round((larguraEscalada - ladoFoto) / 2),
      y: cursorY,
      width: larguraEscalada,
      height: alturaEscalada,
    });
    cursorY += ladoFoto + Math.round(height * 0.04);
  }

  const larguraTexto = width - margem * 2;

  if (textos.headline) {
    const fontSize = Math.round(width * 0.052);
    const texto = `“${textos.headline.trim()}”`;
    const alturaEstimada = estimarAlturaDeTexto(texto, larguraTexto, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, cursorY, larguraTexto, alturaEstimada);
    camadas.push({ tipo: "texto", field: "headline", texto, x: margem, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corLocal, textAlign: "center", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.025);
  }

  if (textos.subheadline) {
    const fontSize = Math.round(width * 0.03);
    const texto = textos.subheadline.trim();
    const alturaEstimada = estimarAlturaDeTexto(texto, larguraTexto, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, cursorY, larguraTexto, alturaEstimada);
    camadas.push({ tipo: "texto", field: "subheadline", texto, x: margem, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corPrimaria ?? corLocal, textAlign: "center", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.03);
  }

  if (textos.cta) {
    const fontSize = Math.round(width * 0.032);
    const texto = textos.cta.trim();
    const padding = Math.round(fontSize * 0.55);
    const larguraCta = Math.min(larguraTexto, Math.round(width * 0.45));
    const alturaTexto = estimarAlturaDeTexto(texto, larguraCta, fontSize);
    const xCta = Math.round((width - (larguraCta + padding * 2)) / 2);
    camadas.push({ tipo: "forma", x: xCta, y: cursorY, width: larguraCta + padding * 2, height: alturaTexto + padding * 2, fill: corPrimaria ?? corDeTextoPadrao(p.luminanciaGeralDoFundo), opacity: 0.92, raioCanto: Math.round(fontSize * 0.4) });
    camadas.push({ tipo: "texto", field: "cta", texto, x: xCta + padding, y: cursorY + padding, width: larguraCta, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corPrimaria ? corDeTextoPadrao(luminanciaRelativaHex(corPrimaria)) : corDeTextoPadrao(1 - p.luminanciaGeralDoFundo), textAlign: "center", required: true });
  }

  if (logo) camadas.push(logoParaCamada(logo, Math.round((width - Math.round(width * 0.14)) / 2), height - margem, Math.round(width * 0.14)));

  return camadas;
}

// ============================================================================
// 6. MINIMAL AUTHORITY — máximo de espaço negativo. Logo pequeno centrado
//    no topo, headline curto centrado no meio, uma única linha fina como
//    acento (nunca um bloco cheio), CTA como texto sublinhado (sem forma
//    de fundo) — deliberadamente o estilo mais "vazio" dos 6, pra marcas
//    que querem parecer estabelecidas/premium em vez de promocionais.
// ============================================================================
async function montarLayoutMinimalAuthority(p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  const { width, height, margem, textos, fontFamilyTitulo, fontFamilyApoio, corPrimaria, logo, fundoBytes } = p;
  const camadas: EspecificacaoDeCamada[] = [];

  if (logo) camadas.push(logoParaCamada(logo, Math.round((width - Math.round(width * 0.12)) / 2), Math.round(height * 0.22), Math.round(width * 0.12)));

  const larguraTexto = Math.round(width * 0.72);
  const xTexto = Math.round((width - larguraTexto) / 2);
  let cursorY = Math.round(height * 0.44);

  if (textos.headline) {
    const fontSize = Math.round(width * 0.05);
    const texto = textos.headline.trim();
    const alturaEstimada = estimarAlturaDeTexto(texto, larguraTexto, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, xTexto, cursorY, larguraTexto, alturaEstimada);
    camadas.push({ tipo: "texto", field: "headline", texto, x: xTexto, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corLocal, textAlign: "center", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.025);
  }

  // Linha fina de acento — único elemento decorativo do estilo.
  const larguraLinha = Math.round(width * 0.1);
  camadas.push({ tipo: "forma", x: Math.round((width - larguraLinha) / 2), y: cursorY, width: larguraLinha, height: Math.max(2, Math.round(height * 0.003)), fill: corPrimaria ?? corDeTextoPadrao(p.luminanciaGeralDoFundo), opacity: 1, raioCanto: 0 });
  cursorY += Math.round(height * 0.03);

  if (textos.subheadline) {
    const fontSize = Math.round(width * 0.026);
    const texto = textos.subheadline.trim();
    const alturaEstimada = estimarAlturaDeTexto(texto, larguraTexto, fontSize);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, xTexto, cursorY, larguraTexto, alturaEstimada);
    camadas.push({ tipo: "texto", field: "subheadline", texto, x: xTexto, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corLocal, textAlign: "center", required: true });
    cursorY += alturaEstimada + Math.round(height * 0.03);
  }

  if (textos.cta) {
    const fontSize = Math.round(width * 0.028);
    const texto = textos.cta.trim().toUpperCase();
    const corLocal = await corDeTextoParaRegiao(fundoBytes, xTexto, cursorY, larguraTexto, Math.round(fontSize * 1.3));
    camadas.push({ tipo: "texto", field: "cta", texto, x: xTexto, y: cursorY, width: larguraTexto, fontSize, fontFamily: fontFamilyTitulo, fontWeight: "bold", fill: corPrimaria ?? corLocal, textAlign: "center", required: true });
  }

  if (textos.caption) {
    const fontSize = Math.round(width * 0.02);
    const corLocal = await corDeTextoParaRegiao(fundoBytes, margem, height - margem - Math.round(fontSize * 1.3), width - margem * 2, Math.round(fontSize * 1.3));
    camadas.push({ tipo: "texto", field: "caption", texto: textos.caption.trim(), x: margem, y: height - margem - Math.round(fontSize * 1.3), width: width - margem * 2, fontSize, fontFamily: fontFamilyApoio, fontWeight: "normal", fill: corLocal, textAlign: "center", required: true });
  }

  return camadas;
}

const MONTADORES: Record<EstiloArteDirecao, (p: ParametrosDeLayout) => Promise<EspecificacaoDeCamada[]>> = {
  editorial: montarLayoutEditorial,
  product_hero: montarLayoutProductHero,
  split_screen: montarLayoutSplitScreen,
  collage: montarLayoutCollage,
  testimonial: montarLayoutTestimonial,
  minimal_authority: montarLayoutMinimalAuthority,
};

// Dispatcher único — nunca lança erro por estilo desconhecido (cai pro
// editorial, o comportamento já provado em produção, em vez de quebrar a
// missão inteira por causa de um valor de enum inesperado vindo do LLM).
export async function montarLayoutPorDirecao(estilo: EstiloArteDirecao | undefined, p: ParametrosDeLayout): Promise<EspecificacaoDeCamada[]> {
  const montador = (estilo && MONTADORES[estilo]) || montarLayoutEditorial;
  return montador(p);
}
