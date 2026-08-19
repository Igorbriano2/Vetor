import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderizarPecaComposta, amostrarLuminanciaMedia } from "./designComposer.js";
import type { EspecificacaoDeCamada } from "./designLayout.js";

async function pngSolido(width: number, height: number, hex: string): Promise<Buffer> {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

describe("renderizarPecaComposta", () => {
  it("compõe fundo real + imagem real + texto real + logo real num único PNG do tamanho pedido", async () => {
    const fundo = await pngSolido(400, 400, "#101010");
    const produto = await pngSolido(50, 50, "#ff0000");
    const logo = await pngSolido(20, 20, "#00ff00");

    const camadas: EspecificacaoDeCamada[] = [
      { tipo: "imagem", role: "fundo", source: "generated", storagePath: "x/fundo.png", bucket: "artifacts", bytes: fundo, naturalWidth: 400, naturalHeight: 400, x: 0, y: 0, width: 400, height: 400 },
      { tipo: "imagem", role: "produto", source: "drive", assetId: "produto-1", storagePath: "x/produto.png", bucket: "brand-assets", bytes: produto, naturalWidth: 50, naturalHeight: 50, x: 100, y: 100, width: 150, height: 150 },
      { tipo: "forma", x: 20, y: 340, width: 120, height: 40, fill: "#ffffff", opacity: 0.85, raioCanto: 8 },
      { tipo: "texto", field: "headline", texto: "Combo Dog Bacon", x: 20, y: 30, width: 360, fontSize: 36, fontFamily: "sans", fontWeight: "bold", fill: "#ffffff", textAlign: "left", required: true },
      { tipo: "logo", assetId: "logo-1", storagePath: "x/logo.png", bucket: "brand-assets", bytes: logo, naturalWidth: 20, naturalHeight: 20, x: 330, y: 330, width: 60, height: 60 },
    ];

    const png = await renderizarPecaComposta({ width: 400, height: 400, corDeFundo: "#ffffff", camadas });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(400);
    expect(meta.format).toBe("png");

    // O pixel dentro da área do "produto" (vermelho) reflete a imagem
    // composta ali, não o fundo escuro por baixo — prova que a composição
    // real aconteceu, não só um retângulo genérico.
    const { data } = await sharp(png).extract({ left: 120, top: 120, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(180); // canal R alto (vermelho)
    expect(data[1]).toBeLessThan(80); // canal G baixo
  });

  it("nunca deixa pixel fora das camadas transparente — usa a cor de fundo pedida", async () => {
    const png = await renderizarPecaComposta({ width: 100, height: 100, corDeFundo: "#123456", camadas: [] });
    const { data } = await sharp(png).extract({ left: 50, top: 50, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBe(0x12);
    expect(data[1]).toBe(0x34);
    expect(data[2]).toBe(0x56);
  });
});

describe("amostrarLuminanciaMedia", () => {
  it("mede luminância real ~0 numa região totalmente preta", async () => {
    const png = await pngSolido(200, 200, "#000000");
    const luminancia = await amostrarLuminanciaMedia(png, { x: 0, y: 0, width: 200, height: 200 });
    expect(luminancia).toBeLessThan(0.02);
  });

  it("mede luminância real ~1 numa região totalmente branca", async () => {
    const png = await pngSolido(200, 200, "#ffffff");
    const luminancia = await amostrarLuminanciaMedia(png, { x: 0, y: 0, width: 200, height: 200 });
    expect(luminancia).toBeGreaterThan(0.98);
  });

  it("nunca lança erro quando a região pedida ultrapassa os limites reais da imagem", async () => {
    const png = await pngSolido(50, 50, "#808080");
    await expect(amostrarLuminanciaMedia(png, { x: 40, y: 40, width: 100, height: 100 })).resolves.toBeGreaterThanOrEqual(0);
  });
});
