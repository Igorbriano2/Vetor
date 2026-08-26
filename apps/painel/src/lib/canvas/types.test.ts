import { describe, expect, it } from "vitest";
import { criarNode, grafoVazio, novoIdNode } from "./types";

describe("grafoVazio", () => {
  it("devolve nodes e edges vazios — nunca um grafo com dado fantasma", () => {
    expect(grafoVazio()).toEqual({ nodes: [], edges: [] });
  });
});

describe("novoIdNode", () => {
  it("nunca repete id entre chamadas seguidas", () => {
    const ids = new Set(Array.from({ length: 20 }, () => novoIdNode()));
    expect(ids.size).toBe(20);
  });
});

describe("criarNode", () => {
  it("cria um node com estado idle e sem erro, na posição pedida", () => {
    const node = criarNode("briefing", { x: 10, y: 20 });
    expect(node.type).toBe("vetorNode");
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.data.tipo).toBe("briefing");
    expect(node.data.estado).toBe("idle");
    expect(node.data.erro).toBeNull();
  });

  it("só node do tipo 'resultado' ganha o campo resultado, e nasce marcado mock — nunca finge um resultado real antes de gerar algo", () => {
    const resultado = criarNode("resultado", { x: 0, y: 0 });
    expect(resultado.data.resultado?.mock).toBe(true);
    expect(resultado.data.resultado?.thumbnailUrl).toBeNull();

    const briefing = criarNode("briefing", { x: 0, y: 0 });
    expect(briefing.data.resultado).toBeUndefined();
  });

  it("node do tipo 'arquivo' nasce com arquivoStatus 'vazio' — nunca 'pronto' antes de um upload real", () => {
    const arquivo = criarNode("arquivo", { x: 0, y: 0 });
    expect(arquivo.data.arquivoStatus).toBe("vazio");
    expect(arquivo.data.arquivoUrl).toBeUndefined();

    const briefing = criarNode("briefing", { x: 0, y: 0 });
    expect(briefing.data.arquivoStatus).toBeUndefined();
  });
});
