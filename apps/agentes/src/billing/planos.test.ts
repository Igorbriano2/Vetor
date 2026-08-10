import { describe, it, expect } from "vitest";
import { planoValidoParaAssinatura, VALOR_CENTAVOS_POR_PLANO } from "./planos.js";

describe("planoValidoParaAssinatura", () => {
  it("aceita os planos fixos da fase 1", () => {
    expect(planoValidoParaAssinatura("design")).toBe(true);
    expect(planoValidoParaAssinatura("social_media")).toBe(true);
    expect(planoValidoParaAssinatura("duplo")).toBe(true);
  });

  it("rejeita planos que ainda nao tem cobranca automatica", () => {
    expect(planoValidoParaAssinatura("trafego")).toBe(false);
    expect(planoValidoParaAssinatura("completo")).toBe(false);
    expect(planoValidoParaAssinatura("inexistente")).toBe(false);
  });

  it("tem um valor definido para cada plano valido", () => {
    expect(VALOR_CENTAVOS_POR_PLANO.design).toBeGreaterThan(0);
    expect(VALOR_CENTAVOS_POR_PLANO.social_media).toBeGreaterThan(0);
    expect(VALOR_CENTAVOS_POR_PLANO.duplo).toBeGreaterThan(0);
  });
});
