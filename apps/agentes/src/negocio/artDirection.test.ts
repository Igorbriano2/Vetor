import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { montarLayoutPorDirecao, ESTILOS_ARTE_DIRECAO, type ParametrosDeLayout, type AtivoDeImagemLayout, type LogoParaLayout } from "./artDirection.js";
import type { EspecificacaoTexto, EspecificacaoLogo, EspecificacaoImagem } from "./designLayout.js";

async function pngSolido(width: number, height: number, hex: string): Promise<Buffer> {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

async function montarParametrosBase(overrides: Partial<ParametrosDeLayout> = {}): Promise<ParametrosDeLayout> {
  const width = 1080;
  const height = 1350;
  const fundoBytes = await pngSolido(width, height, "#3a3a3a");
  const ativoDrive: AtivoDeImagemLayout = {
    assetId: "ativo-1",
    storagePath: "x/produto.png",
    bytes: await pngSolido(600, 600, "#c0392b"),
    naturalWidth: 600,
    naturalHeight: 600,
    role: "produto",
  };
  const logo: LogoParaLayout = {
    id: "logo-1",
    storagePath: "x/logo.png",
    bytes: await pngSolido(200, 100, "#ffffff"),
    naturalWidth: 200,
    naturalHeight: 100,
  };

  return {
    width,
    height,
    margem: Math.round(Math.min(width, height) * 0.07),
    pathFundo: "x/fundo.png",
    fundoBytes,
    luminanciaGeralDoFundo: 0.22,
    textos: {
      headline: "Combo Dog Bacon por R$ 24,90",
      subheadline: "Peça agora e receba em 30 minutos",
      cta: "Peça já",
      caption: "Promoção da semana",
    },
    fontFamilyTitulo: "Poppins",
    fontFamilyApoio: "Inter",
    corPrimaria: "#e67e22",
    ativosDrive: [ativoDrive],
    logo,
    ...overrides,
  };
}

function dentroDoCanvas(camada: { x: number; y: number; width: number; height: number }, width: number, height: number, tolerancia = 2) {
  expect(camada.x).toBeGreaterThanOrEqual(-tolerancia);
  expect(camada.y).toBeGreaterThanOrEqual(-tolerancia);
  expect(camada.x + camada.width).toBeLessThanOrEqual(width + tolerancia);
  expect(camada.y + camada.height).toBeLessThanOrEqual(height + tolerancia);
}

describe("montarLayoutPorDirecao", () => {
  it.each(ESTILOS_ARTE_DIRECAO)("estilo '%s' produz apenas camadas dentro do canvas", async (estilo) => {
    const params = await montarParametrosBase();
    const camadas = await montarLayoutPorDirecao(estilo, params);

    expect(camadas.length).toBeGreaterThan(0);
    for (const camada of camadas) {
      if (camada.tipo === "imagem" || camada.tipo === "forma" || camada.tipo === "logo") {
        dentroDoCanvas(camada, params.width, params.height);
      }
    }
  });

  it.each(ESTILOS_ARTE_DIRECAO)("estilo '%s' inclui o logo quando fornecido, sem duplicar", async (estilo) => {
    const params = await montarParametrosBase();
    const camadas = await montarLayoutPorDirecao(estilo, params);
    const logos = camadas.filter((c) => c.tipo === "logo") as EspecificacaoLogo[];
    expect(logos.length).toBe(1);
    expect(logos[0]!.assetId).toBe("logo-1");
  });

  it.each(ESTILOS_ARTE_DIRECAO)("estilo '%s' nunca emite texto obrigatório vazio quando o campo foi pedido", async (estilo) => {
    const params = await montarParametrosBase();
    const camadas = await montarLayoutPorDirecao(estilo, params);
    const textos = camadas.filter((c) => c.tipo === "texto") as EspecificacaoTexto[];
    for (const t of textos) {
      expect(t.texto.trim().length).toBeGreaterThan(0);
    }
  });

  it("estilo desconhecido cai pro editorial em vez de lançar erro", async () => {
    const params = await montarParametrosBase();
    // @ts-expect-error -- valor de enum inválido de propósito, simula resposta inesperada do LLM
    const camadas = await montarLayoutPorDirecao("estilo-que-nao-existe", params);
    const editorial = await montarLayoutPorDirecao("editorial", params);
    expect(camadas.length).toBe(editorial.length);
  });

  it("sem estilo definido, usa editorial por padrão", async () => {
    const params = await montarParametrosBase();
    const semEstilo = await montarLayoutPorDirecao(undefined, params);
    const editorial = await montarLayoutPorDirecao("editorial", params);
    expect(semEstilo.length).toBe(editorial.length);
  });

  describe("editorial", () => {
    it("headline fica alinhado à esquerda, no topo, antes do CTA", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("editorial", params);
      const headline = camadas.find((c) => c.tipo === "texto" && c.field === "headline") as EspecificacaoTexto;
      const cta = camadas.find((c) => c.tipo === "texto" && c.field === "cta") as EspecificacaoTexto;
      expect(headline.textAlign).toBe("left");
      expect(headline.y).toBeLessThan(cta.y);
    });

    it("logo fica no canto inferior direito", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("editorial", params);
      const logo = camadas.find((c) => c.tipo === "logo")!;
      expect(logo.x).toBeGreaterThan(params.width / 2);
      expect(logo.y).toBeGreaterThan(params.height / 2);
    });
  });

  describe("product_hero", () => {
    it("o ativo do Drive ocupa a região superior, acima da faixa de texto sólida", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("product_hero", params);
      const faixa = camadas.find((c) => c.tipo === "forma")!;
      const produto = camadas.find((c) => c.tipo === "imagem" && c.role === "produto") as EspecificacaoImagem;
      expect(faixa.width).toBe(params.width);
      expect(produto.y + produto.height).toBeLessThanOrEqual(faixa.y + 2);
    });

    it("sem nenhum ativo do Drive, não inventa camada de produto — só a faixa de texto", async () => {
      const params = await montarParametrosBase({ ativosDrive: [] });
      const camadas = await montarLayoutPorDirecao("product_hero", params);
      expect(camadas.some((c) => c.tipo === "imagem")).toBe(false);
    });
  });

  describe("split_screen", () => {
    it("painel sólido cobre a metade esquerda; o ativo do Drive cobre a direita", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("split_screen", params);
      const painel = camadas.find((c) => c.tipo === "forma")!;
      expect(painel.x).toBe(0);
      expect(painel.width).toBeCloseTo(params.width * 0.5, 0);
      expect(painel.height).toBe(params.height);

      const imagem = camadas.find((c) => c.tipo === "imagem")!;
      expect(imagem.x + imagem.width).toBeGreaterThan(params.width * 0.5);
    });

    it("todo texto fica dentro da metade esquerda (painel)", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("split_screen", params);
      const textos = camadas.filter((c) => c.tipo === "texto") as EspecificacaoTexto[];
      for (const t of textos) {
        expect(t.x + t.width).toBeLessThanOrEqual(params.width * 0.5 + 2);
      }
    });
  });

  describe("collage", () => {
    it("com 2+ ativos do Drive, monta dois blocos de imagem em tamanhos diferentes", async () => {
      const ativoB: AtivoDeImagemLayout = {
        assetId: "ativo-2",
        storagePath: "x/produto2.png",
        bytes: await pngSolido(400, 500, "#2980b9"),
        naturalWidth: 400,
        naturalHeight: 500,
        role: "elemento",
      };
      const base = await montarParametrosBase();
      const params = await montarParametrosBase({ ativosDrive: [base.ativosDrive[0]!, ativoB] });
      const camadas = await montarLayoutPorDirecao("collage", params);
      const imagens = camadas.filter((c) => c.tipo === "imagem");
      expect(imagens.length).toBe(2);
      expect(imagens[0]!.width).not.toBe(imagens[1]!.width);
    });

    it("com menos de 2 ativos, cai honestamente pro editorial em vez de fingir uma colagem", async () => {
      const params = await montarParametrosBase();
      const collage = await montarLayoutPorDirecao("collage", params);
      const editorial = await montarLayoutPorDirecao("editorial", params);
      expect(collage.length).toBe(editorial.length);
    });
  });

  describe("testimonial", () => {
    it("centraliza todo o texto e trata o headline como citação", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("testimonial", params);
      const headline = camadas.find((c) => c.tipo === "texto" && c.field === "headline") as EspecificacaoTexto;
      expect(headline.textAlign).toBe("center");
      expect(headline.texto.startsWith("“")).toBe(true);

      const textos = camadas.filter((c) => c.tipo === "texto") as EspecificacaoTexto[];
      for (const t of textos) expect(t.textAlign).toBe("center");
    });

    it("a foto da pessoa (quando existe) fica acima da citação", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("testimonial", params);
      const foto = camadas.find((c) => c.tipo === "imagem")!;
      const headline = camadas.find((c) => c.tipo === "texto" && c.field === "headline")!;
      expect(foto.y).toBeLessThan(headline.y);
    });
  });

  describe("minimal_authority", () => {
    it("é o estilo com menos camadas — máximo de espaço negativo", async () => {
      const params = await montarParametrosBase();
      const [editorial, minimal] = await Promise.all([
        montarLayoutPorDirecao("editorial", params),
        montarLayoutPorDirecao("minimal_authority", params),
      ]);
      expect(minimal.length).toBeLessThan(editorial.length);
    });

    it("nunca usa o ativo do Drive nem forma de fundo atrás do CTA — só uma linha fina de acento", async () => {
      const params = await montarParametrosBase();
      const camadas = await montarLayoutPorDirecao("minimal_authority", params);
      expect(camadas.some((c) => c.tipo === "imagem")).toBe(false);
      const formas = camadas.filter((c) => c.tipo === "forma");
      expect(formas.length).toBe(1);
      expect(formas[0]!.height).toBeLessThan(10);
    });
  });
});
