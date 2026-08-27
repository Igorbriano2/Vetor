import { describe, expect, it } from "vitest";
import { mapearStatus, extrairCompras, extrairReceita, calcularRoas, calcularRoi, calcularCustoPorCompra } from "./metaAdsSync.js";

describe("mapearStatus", () => {
  it("mapeia os status conhecidos da Graph API", () => {
    expect(mapearStatus("ACTIVE")).toBe("ativa");
    expect(mapearStatus("PAUSED")).toBe("pausada");
    expect(mapearStatus("ARCHIVED")).toBe("arquivada");
    expect(mapearStatus("DELETED")).toBe("arquivada");
  });

  it("cai em rascunho pra status desconhecido — fail-closed, nunca assume ativa", () => {
    expect(mapearStatus("QUALQUER_COISA_NOVA")).toBe("rascunho");
  });
});

describe("extrairCompras", () => {
  it("soma os action_type reais de compra, ignora os demais", () => {
    const total = extrairCompras({
      actions: [
        { action_type: "purchase", value: "3" },
        { action_type: "omni_purchase", value: "2" },
        { action_type: "link_click", value: "40" },
      ],
    });
    expect(total).toBe(5);
  });

  it("devolve 0 sem inventar conversão quando não há actions", () => {
    expect(extrairCompras(undefined)).toBe(0);
    expect(extrairCompras({})).toBe(0);
  });
});

describe("extrairReceita", () => {
  it("soma o valor monetário só dos action_type de compra, ignora outros", () => {
    const receita = extrairReceita({
      action_values: [
        { action_type: "purchase", value: "150.50" },
        { action_type: "link_click", value: "999" },
      ],
    });
    expect(receita).toBe(150.5);
  });

  it("devolve 0 sem inventar receita quando não há action_values", () => {
    expect(extrairReceita(undefined)).toBe(0);
    expect(extrairReceita({})).toBe(0);
  });
});

describe("calcularRoas", () => {
  it("usa o purchase_roas nativo da Graph API quando disponível, não recalcula", () => {
    const roas = calcularRoas({ purchase_roas: [{ action_type: "purchase", value: "4.2" }] }, 999, 999);
    expect(roas).toBe(4.2);
  });

  it("cai pro cálculo manual receita/gasto quando não há purchase_roas nativo", () => {
    expect(calcularRoas({}, 300, 100)).toBe(3);
  });

  it("devolve null (não zero) sem gasto — nunca inventa ROAS de uma conta sem investimento", () => {
    expect(calcularRoas({}, 0, 0)).toBeNull();
  });
});

describe("calcularRoi", () => {
  it("calcula (receita - gasto) / gasto", () => {
    expect(calcularRoi(300, 100)).toBe(2);
    expect(calcularRoi(50, 100)).toBe(-0.5);
  });

  it("devolve null sem gasto — nunca divide por zero silenciosamente", () => {
    expect(calcularRoi(0, 0)).toBeNull();
  });
});

describe("calcularCustoPorCompra", () => {
  it("usa o cost_per_action_type nativo quando disponível", () => {
    expect(calcularCustoPorCompra({ cost_per_action_type: [{ action_type: "omni_purchase", value: "12.5" }] }, 999, 999)).toBe(12.5);
  });

  it("cai pro cálculo manual gasto/compras sem o campo nativo", () => {
    expect(calcularCustoPorCompra({}, 100, 10)).toBe(10);
  });

  it("devolve null sem compras — nunca divide por zero silenciosamente", () => {
    expect(calcularCustoPorCompra({}, 100, 0)).toBeNull();
  });
});
