// Design profissional V1 — renderizador determinístico server-side. Compõe
// fundo real + camadas de imagem reais (Drive) + texto real + logo real num
// único PNG final via sharp (Apache-2.0, já usado transitivamente pelo
// painel/Next.js — wraps libvips, binário nativo por plataforma).
//
// Princípio central desta peça: o PREVIEW renderizado aqui usa a MESMA
// `EspecificacaoDeCamada[]` (ver designLayout.ts) que vira o canvasJson
// salvo (ver designProjects.ts::montarCanvasJsonEmCamadas) — nunca uma
// lógica de layout duplicada e potencialmente divergente.

import sharp, { type OverlayOptions } from "sharp";
import { luminanciaRelativaRGB, type EspecificacaoDeCamada } from "./designLayout.js";

function escaparPango(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function renderizarCamadaDeTexto(camada: Extract<EspecificacaoDeCamada, { tipo: "texto" }>): Promise<Buffer> {
  const peso = camada.fontWeight === "bold" ? "Bold" : "";
  const marcado = `<span foreground="${camada.fill}">${escaparPango(camada.texto)}</span>`;
  return sharp({
    text: {
      text: marcado,
      font: `sans ${peso}`.trim() + ` ${camada.fontSize}`,
      width: Math.max(1, Math.round(camada.width)),
      rgba: true,
      align: camada.textAlign,
    },
  })
    .png()
    .toBuffer();
}

async function renderizarCamadaDeForma(camada: Extract<EspecificacaoDeCamada, { tipo: "forma" }>): Promise<Buffer> {
  const w = Math.max(1, Math.round(camada.width));
  const h = Math.max(1, Math.round(camada.height));
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${w}" height="${h}" rx="${camada.raioCanto}" fill="${camada.fill}" fill-opacity="${camada.opacity}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Renderiza o PNG final compondo as camadas NA ORDEM dada (índice 0 = mais
// ao fundo — mesma convenção que o array `objects` do Fabric.js usa como
// z-index implícito). Fundo sólido garante que nunca sobra pixel
// transparente nas bordas.
export async function renderizarPecaComposta(params: {
  width: number;
  height: number;
  corDeFundo: string;
  camadas: EspecificacaoDeCamada[];
}): Promise<Buffer> {
  const composicoes: OverlayOptions[] = [];

  for (const camada of params.camadas) {
    if (camada.tipo === "imagem" || camada.tipo === "logo") {
      const redimensionada = await sharp(camada.bytes)
        .resize(Math.max(1, Math.round(camada.width)), Math.max(1, Math.round(camada.height)), { fit: "fill" })
        .png()
        .toBuffer();
      composicoes.push({ input: redimensionada, left: Math.round(camada.x), top: Math.round(camada.y) });
    } else if (camada.tipo === "forma") {
      const bytes = await renderizarCamadaDeForma(camada);
      composicoes.push({ input: bytes, left: Math.round(camada.x), top: Math.round(camada.y) });
    } else {
      const bytes = await renderizarCamadaDeTexto(camada);
      composicoes.push({ input: bytes, left: Math.round(camada.x), top: Math.round(camada.y) });
    }
  }

  return sharp({
    create: {
      width: params.width,
      height: params.height,
      channels: 3,
      background: params.corDeFundo,
    },
  })
    .composite(composicoes)
    .png()
    .toBuffer();
}

// Amostra a luminância média real de uma região do PNG (nunca chuta a cor
// do fundo) — base do check de contraste texto/fundo (Fase 3). Reduz a
// região a 8x8 antes de calcular a média: rápido e suficiente pra decidir
// "claro ou escuro ali", não precisão fotográfica.
export async function amostrarLuminanciaMedia(
  pngBytes: Buffer,
  regiao: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const meta = await sharp(pngBytes).metadata();
  const larguraTotal = meta.width ?? regiao.x + regiao.width;
  const alturaTotal = meta.height ?? regiao.y + regiao.height;

  // Recorta a região dentro dos limites reais da imagem — nunca pede um
  // extract fora dos limites (sharp lança erro), o que aconteceria se um
  // texto ficasse parcialmente fora do canvas por um bug de layout.
  const left = Math.max(0, Math.min(Math.round(regiao.x), larguraTotal - 1));
  const top = Math.max(0, Math.min(Math.round(regiao.y), alturaTotal - 1));
  const width = Math.max(1, Math.min(Math.round(regiao.width), larguraTotal - left));
  const height = Math.max(1, Math.min(Math.round(regiao.height), alturaTotal - top));

  const { data, info } = await sharp(pngBytes)
    .extract({ left, top, width, height })
    .resize(8, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let somaLuminancia = 0;
  let amostras = 0;
  for (let i = 0; i + info.channels <= data.length; i += info.channels) {
    somaLuminancia += luminanciaRelativaRGB(data[i]!, data[i + 1]!, data[i + 2]!);
    amostras++;
  }
  return amostras > 0 ? somaLuminancia / amostras : 0.5;
}
