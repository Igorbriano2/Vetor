import { describe, expect, it } from "vitest";
import { mapearStatus, extrairCompras } from "./metaAdsSync.js";

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
