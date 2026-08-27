import { describe, expect, it } from "vitest";
import {
  mapearFormatoParaAspectRatio,
  montarPromptDeFundo,
  detectarPlaceholder,
  validarAreaSegura,
  luminanciaRelativaRGB,
  luminanciaRelativaHex,
  calcularContraste,
  corDeTextoPadrao,
  estimarAlturaDeTexto,
  CONTRASTE_MINIMO_LEGIVEL,
} from "./designLayout.js";

describe("mapearFormatoParaAspectRatio", () => {
  it("feed é sempre 1:1", () => {
    expect(mapearFormatoParaAspectRatio("feed")).toBe("1:1");
  });
  it("story e reels_cover são 9:16", () => {
    expect(mapearFormatoParaAspectRatio("story")).toBe("9:16");
    expect(mapearFormatoParaAspectRatio("reels_cover")).toBe("9:16");
  });
  it("ad usa 4:5 por padrão, mas respeita aspect_ratio explícito", () => {
    expect(mapearFormatoParaAspectRatio("ad")).toBe("4:5");
    expect(mapearFormatoParaAspectRatio("ad", "16:9")).toBe("16:9");
  });
  it("custom exige aspect_ratio explícito", () => {
    expect(() => mapearFormatoParaAspectRatio("custom")).toThrow();
    expect(mapearFormatoParaAspectRatio("custom", "2:3")).toBe("2:3");
  });
});

describe("montarPromptDeFundo", () => {
  it("sempre acrescenta a restrição de nunca desenhar texto/logo, mesmo que o prompt original não mencione isso", () => {
    const resultado = montarPromptDeFundo("Uma mesa de restaurante com hambúrguer artesanal, luz quente");
    expect(resultado).toContain("Uma mesa de restaurante com hambúrguer artesanal");
    expect(resultado.toLowerCase()).toContain("nunca inclua texto");
    expect(resultado.toLowerCase()).toContain("logotipos");
  });

  it("sempre acrescenta o reforço de direção de arte/qualidade fotográfica", () => {
    const resultado = montarPromptDeFundo("Uma mesa de restaurante com hambúrguer artesanal, luz quente");
    expect(resultado.toLowerCase()).toContain("profundidade de campo");
  });

  it("remove código de cor hexadecimal do prompt — achado real: o modelo de imagem desenha o código como texto literal na peça", () => {
    const resultado = montarPromptDeFundo("Fundo gradiente laranja (#FF6B35) pra vermelho (#C1121F)");
    expect(resultado).not.toContain("#FF6B35");
    expect(resultado).not.toContain("#C1121F");
    expect(resultado).toContain("Fundo gradiente laranja");
  });

  it("não mexe no prompt quando não há código hex nenhum", () => {
    const resultado = montarPromptDeFundo("Fundo gradiente laranja vibrante");
    expect(resultado).toContain("Fundo gradiente laranja vibrante");
  });
});

describe("detectarPlaceholder", () => {
  it("detecta os marcadores óbvios de texto não preenchido", () => {
    expect(detectarPlaceholder("Lorem ipsum dolor sit amet")).toBe(true);
    expect(detectarPlaceholder("[CTA]")).toBe(true);
    expect(detectarPlaceholder("Insira texto aqui")).toBe(true);
    expect(detectarPlaceholder("  PLACEHOLDER  ")).toBe(true);
  });
  it("não marca copy real como placeholder", () => {
    expect(detectarPlaceholder("Combo Dog Bacon por R$29,90")).toBe(false);
    expect(detectarPlaceholder("Peça já pelo WhatsApp")).toBe(false);
  });
  it("string vazia nunca é placeholder (campo vazio é outro tipo de problema)", () => {
    expect(detectarPlaceholder("")).toBe(false);
    expect(detectarPlaceholder("   ")).toBe(false);
  });
});

describe("validarAreaSegura", () => {
  const CANVAS = { canvasWidth: 1080, canvasHeight: 1080 };

  it("aprova uma caixa bem dentro da margem", () => {
    expect(validarAreaSegura({ x: 100, y: 100, width: 800, height: 200 }, CANVAS.canvasWidth, CANVAS.canvasHeight)).toBe(true);
  });

  it("reprova uma caixa que invade a margem esquerda", () => {
    expect(validarAreaSegura({ x: 0, y: 100, width: 800, height: 200 }, CANVAS.canvasWidth, CANVAS.canvasHeight)).toBe(false);
  });

  it("reprova uma caixa que estoura a borda direita/inferior", () => {
    expect(validarAreaSegura({ x: 900, y: 900, width: 300, height: 300 }, CANVAS.canvasWidth, CANVAS.canvasHeight)).toBe(false);
  });
});

describe("luminância e contraste", () => {
  it("preto tem luminância 0, branco tem luminância 1", () => {
    expect(luminanciaRelativaRGB(0, 0, 0)).toBeCloseTo(0, 5);
    expect(luminanciaRelativaRGB(255, 255, 255)).toBeCloseTo(1, 5);
  });

  it("luminanciaRelativaHex bate com luminanciaRelativaRGB pra mesma cor", () => {
    expect(luminanciaRelativaHex("#ffffff")).toBeCloseTo(luminanciaRelativaRGB(255, 255, 255), 5);
    expect(luminanciaRelativaHex("#000000")).toBeCloseTo(luminanciaRelativaRGB(0, 0, 0), 5);
  });

  it("preto sobre branco tem o contraste máximo (21:1)", () => {
    expect(calcularContraste(0, 1)).toBeCloseTo(21, 0);
  });

  it("contraste é simétrico (não importa a ordem dos argumentos)", () => {
    const a = calcularContraste(0.2, 0.8);
    const b = calcularContraste(0.8, 0.2);
    expect(a).toBeCloseTo(b, 10);
  });

  it("cinza sobre cinza parecido fica abaixo do mínimo legível", () => {
    const contraste = calcularContraste(luminanciaRelativaHex("#888888"), luminanciaRelativaHex("#999999"));
    expect(contraste).toBeLessThan(CONTRASTE_MINIMO_LEGIVEL);
  });

  it("corDeTextoPadrao escolhe branco sobre fundo escuro e preto sobre fundo claro", () => {
    expect(corDeTextoPadrao(0.05)).toBe("#ffffff");
    expect(corDeTextoPadrao(0.9)).toBe("#151515");
  });
});

describe("estimarAlturaDeTexto", () => {
  it("texto curto que cabe numa linha só tem altura ~1 linha", () => {
    const altura = estimarAlturaDeTexto("Oi", 900, 40);
    expect(altura).toBeCloseTo(40 * 1.3, 0);
  });

  it("texto bem mais longo que a largura disponível estima múltiplas linhas", () => {
    const textoLongo = "Combo Dog Bacon com batata frita crocante e refrigerante gelado por um preço especial";
    const alturaEstreita = estimarAlturaDeTexto(textoLongo, 200, 40);
    const alturaLarga = estimarAlturaDeTexto(textoLongo, 2000, 40);
    expect(alturaEstreita).toBeGreaterThan(alturaLarga);
  });

  it("nunca devolve altura zero ou negativa mesmo com texto vazio", () => {
    expect(estimarAlturaDeTexto("", 900, 40)).toBeGreaterThan(0);
  });
});
