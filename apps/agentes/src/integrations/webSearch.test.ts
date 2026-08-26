import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { pesquisarMercado, PesquisaWebIndisponivelError } from "./webSearch.js";

describe("pesquisarMercado", () => {
  const original = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = original;
    vi.unstubAllGlobals();
  });

  it("lança PesquisaWebIndisponivelError sem TAVILY_API_KEY, nunca chama rede", async () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);

    await expect(pesquisarMercado("hamburgueria Cambé PR")).rejects.toThrow(PesquisaWebIndisponivelError);
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("com chave configurada, parseia a resposta real da Tavily corretamente", async () => {
    process.env.TAVILY_API_KEY = "tvly-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          answer: "Cambé-PR tem mercado de delivery de lanches ativo.",
          results: [
            { title: "Concorrente A", url: "https://example.com/a", content: "hamburgueria local" },
            { title: "Concorrente B", url: "https://example.com/b", content: "hot dog gourmet" },
          ],
        }),
      })),
    );

    const resposta = await pesquisarMercado("concorrentes hamburgueria Cambé PR");
    expect(resposta.respostaDireta).toContain("delivery de lanches");
    expect(resposta.resultados).toHaveLength(2);
    expect(resposta.resultados[0]).toEqual({ titulo: "Concorrente A", url: "https://example.com/a", resumo: "hamburgueria local" });
  });

  it("propaga erro da API sem inventar resultado", async () => {
    process.env.TAVILY_API_KEY = "tvly-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "unauthorized" })),
    );

    await expect(pesquisarMercado("qualquer coisa")).rejects.toThrow(PesquisaWebIndisponivelError);
  });

  it("descarta resultados sem título ou url em vez de quebrar", async () => {
    process.env.TAVILY_API_KEY = "tvly-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: [{ title: "Só título" }, { url: "https://example.com/c" }, { title: "Ok", url: "https://example.com/d", content: "x" }] }),
      })),
    );

    const resposta = await pesquisarMercado("teste");
    expect(resposta.resultados).toEqual([{ titulo: "Ok", url: "https://example.com/d", resumo: "x" }]);
  });
});
