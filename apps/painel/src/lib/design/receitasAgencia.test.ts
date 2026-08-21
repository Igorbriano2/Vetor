import { describe, expect, it } from "vitest";
import { RECEITAS_AGENCIA, queryDaReceita } from "./receitasAgencia";

describe("receitasAgencia", () => {
  it("tem as 8 receitas pedidas, cada uma com estilo visual válido", () => {
    expect(RECEITAS_AGENCIA).toHaveLength(8);
    const estilos = ["editorial", "product_hero", "split_screen", "collage", "testimonial", "minimal_authority"];
    for (const r of RECEITAS_AGENCIA) {
      expect(estilos).toContain(r.estiloVisual);
      expect(r.objetivo.length).toBeGreaterThan(0);
    }
  });

  it("monta query string com os mesmos parâmetros que o wizard de Design lê", () => {
    const query = queryDaReceita(RECEITAS_AGENCIA[0]);
    const params = new URLSearchParams(query);
    expect(params.get("template")).toBe(RECEITAS_AGENCIA[0].nome);
    expect(params.get("objetivo")).toBe(RECEITAS_AGENCIA[0].objetivo);
    expect(params.get("estiloVisual")).toBe(RECEITAS_AGENCIA[0].estiloVisual);
  });
});
