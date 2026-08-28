import { describe, expect, it } from "vitest";
import { detectarNicho } from "./detectarNicho";

describe("detectarNicho", () => {
  it("reconhece restaurante/lanchonete", () => {
    expect(detectarNicho("Lanchonete / Hamburgueria")).toBe("restaurante");
    expect(detectarNicho("Pizzaria")).toBe("restaurante");
  });

  it("reconhece advocacia", () => {
    expect(detectarNicho("Escritório de advocacia")).toBe("advocacia");
  });

  it("reconhece clínica", () => {
    expect(detectarNicho("Clínica de estética")).toBe("clinica");
  });

  it("cai pra 'geral' quando nada bate ou é nulo — nunca chuta", () => {
    expect(detectarNicho("Loja de roupas")).toBe("geral");
    expect(detectarNicho(null)).toBe("geral");
    expect(detectarNicho(undefined)).toBe("geral");
  });
});
