import { describe, expect, it } from "vitest";
import { resolverArquivoDeFonte } from "./designFonts.js";

describe("resolverArquivoDeFonte", () => {
  it("devolve o .ttf bold de verdade pra uma família empacotada", () => {
    const caminho = resolverArquivoDeFonte("Passion One", "bold");
    expect(caminho).toBeDefined();
    expect(caminho).toMatch(/PassionOne-Bold\.ttf$/);
  });

  it("devolve o .ttf regular pra peso normal", () => {
    const caminho = resolverArquivoDeFonte("Rubik", "normal");
    expect(caminho).toBeDefined();
    expect(caminho).toMatch(/Rubik-Regular\.ttf$/);
  });

  it("devolve undefined pra família não empacotada (fallback 'sans' continua sem fontfile)", () => {
    expect(resolverArquivoDeFonte("sans", "bold")).toBeUndefined();
    expect(resolverArquivoDeFonte("Uma Fonte Qualquer", "normal")).toBeUndefined();
  });
});
