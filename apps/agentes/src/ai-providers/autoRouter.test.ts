import { describe, expect, it } from "vitest";
import { AutoRouterPadrao } from "./autoRouter.js";
import type { AIModel } from "./types.js";

function modelo(overrides: Partial<AIModel>): AIModel {
  return {
    id: "m",
    providerId: "mock",
    providerModelId: "m",
    kind: "image",
    label: "m",
    capabilities: {},
    costCredits: 5,
    avgLatencyMs: 1000,
    status: "available",
    ...overrides,
  };
}

describe("AutoRouterPadrao", () => {
  it("nunca escolhe um modelo de kind diferente do pedido", () => {
    const roteador = new AutoRouterPadrao();
    const modelos = [modelo({ id: "video-1", kind: "video" }), modelo({ id: "image-1", kind: "image" })];
    const escolhido = roteador.pickModel({ kind: "image", modelId: "auto" }, modelos);
    expect(escolhido.id).toBe("image-1");
  });

  it("nunca escolhe um modelo deprecated se houver alternativa", () => {
    const roteador = new AutoRouterPadrao();
    const modelos = [modelo({ id: "velho", status: "deprecated", costCredits: 1 }), modelo({ id: "novo", costCredits: 10 })];
    const escolhido = roteador.pickModel({ kind: "image", modelId: "auto" }, modelos);
    expect(escolhido.id).toBe("novo");
  });

  it("prioriza featured sobre available, mesmo custando mais", () => {
    const roteador = new AutoRouterPadrao();
    const modelos = [modelo({ id: "barato-available", status: "available", costCredits: 1 }), modelo({ id: "featured", status: "featured", costCredits: 10 })];
    const escolhido = roteador.pickModel({ kind: "image", modelId: "auto" }, modelos);
    expect(escolhido.id).toBe("featured");
  });

  it("entre modelos empatados em prioridade, escolhe o mais barato", () => {
    const roteador = new AutoRouterPadrao();
    const modelos = [modelo({ id: "caro", status: "featured", costCredits: 20 }), modelo({ id: "barato", status: "featured", costCredits: 5 })];
    const escolhido = roteador.pickModel({ kind: "image", modelId: "auto" }, modelos);
    expect(escolhido.id).toBe("barato");
  });

  it("pedido com referência de imagem nunca escolhe modelo sem essa capability, se houver alternativa", () => {
    const roteador = new AutoRouterPadrao();
    const modelos = [
      modelo({ id: "sem-referencia", status: "featured", costCredits: 1, capabilities: {} }),
      modelo({ id: "com-referencia", status: "available", costCredits: 8, capabilities: { referenceImages: true } }),
    ];
    const escolhido = roteador.pickModel({ kind: "image", modelId: "auto", referenceAssetIds: ["a1"] }, modelos);
    expect(escolhido.id).toBe("com-referencia");
  });

  it("se NENHUM modelo suporta a capability exigida, cai pro pool geral em vez de travar", () => {
    const roteador = new AutoRouterPadrao();
    const modelos = [modelo({ id: "unico", status: "featured", capabilities: {} })];
    const escolhido = roteador.pickModel({ kind: "image", modelId: "auto", referenceAssetIds: ["a1"] }, modelos);
    expect(escolhido.id).toBe("unico");
  });

  it("lança erro claro quando não existe nenhum modelo pro kind pedido", () => {
    const roteador = new AutoRouterPadrao();
    expect(() => roteador.pickModel({ kind: "3d", modelId: "auto" }, [modelo({ kind: "image" })])).toThrow(/3d/);
  });
});
