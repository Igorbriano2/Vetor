import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { transcreverComAssemblyAI, agruparPalavrasEmSegmentos, AssemblyAiIndisponivelError } from "./assemblyai.js";

describe("transcreverComAssemblyAI", () => {
  const original = process.env.ASSEMBLYAI_API_KEY;

  beforeEach(() => {
    delete process.env.ASSEMBLYAI_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ASSEMBLYAI_API_KEY;
    else process.env.ASSEMBLYAI_API_KEY = original;
    vi.unstubAllGlobals();
  });

  it("lança AssemblyAiIndisponivelError sem ASSEMBLYAI_API_KEY, nunca chama rede", async () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);

    await expect(transcreverComAssemblyAI(new ArrayBuffer(8))).rejects.toThrow(AssemblyAiIndisponivelError);
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("com chave configurada, faz upload, submete, espera conclusão e agrupa as palavras", async () => {
    process.env.ASSEMBLYAI_API_KEY = "aai-teste";
    const fetchEspiao = vi.fn(
      async (url: string) => {
        if (url.endsWith("/v2/upload")) {
          return { ok: true, json: async () => ({ upload_url: "https://cdn.assemblyai.com/upload/x" }) };
        }
        if (url.endsWith("/v2/transcript")) {
          return { ok: true, json: async () => ({ id: "transcript-1" }) };
        }
        if (url.endsWith("/v2/transcript/transcript-1")) {
          return {
            ok: true,
            json: async () => ({
              id: "transcript-1",
              status: "completed",
              words: [
                { text: "Oi,", start: 0, end: 200, confidence: 0.99 },
                { text: "tudo", start: 250, end: 450, confidence: 0.98 },
                { text: "bem?", start: 460, end: 700, confidence: 0.97 },
              ],
            }),
          };
        }
        throw new Error(`URL inesperada no teste: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchEspiao);

    const segmentos = await transcreverComAssemblyAI(new ArrayBuffer(8));
    expect(segmentos).toEqual([{ startMs: 0, endMs: 700, text: "Oi, tudo bem?" }]);
  });

  it("propaga erro da API sem inventar transcrição", async () => {
    process.env.ASSEMBLYAI_API_KEY = "aai-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "unauthorized" })),
    );

    await expect(transcreverComAssemblyAI(new ArrayBuffer(8))).rejects.toThrow(AssemblyAiIndisponivelError);
  });

  it("devolve lista vazia quando a transcrição não detecta nenhuma palavra (ex: só música/ruído)", async () => {
    process.env.ASSEMBLYAI_API_KEY = "aai-teste";
    const fetchEspiao = vi.fn(async (url: string) => {
      if (url.endsWith("/v2/upload")) return { ok: true, json: async () => ({ upload_url: "https://cdn.assemblyai.com/upload/x" }) };
      if (url.endsWith("/v2/transcript")) return { ok: true, json: async () => ({ id: "transcript-2" }) };
      return { ok: true, json: async () => ({ id: "transcript-2", status: "completed", words: [] }) };
    });
    vi.stubGlobal("fetch", fetchEspiao);

    expect(await transcreverComAssemblyAI(new ArrayBuffer(8))).toEqual([]);
  });
});

describe("agruparPalavrasEmSegmentos", () => {
  it("agrupa palavras contíguas numa única cue", () => {
    const palavras = [
      { text: "Vamos", start: 0, end: 300, confidence: 0.9 },
      { text: "testar", start: 320, end: 600, confidence: 0.9 },
      { text: "isso.", start: 610, end: 900, confidence: 0.9 },
    ];
    expect(agruparPalavrasEmSegmentos(palavras)).toEqual([{ startMs: 0, endMs: 900, text: "Vamos testar isso." }]);
  });

  it("quebra em nova cue quando há pausa maior que 500ms", () => {
    const palavras = [
      { text: "Primeira", start: 0, end: 300, confidence: 0.9 },
      { text: "frase.", start: 320, end: 600, confidence: 0.9 },
      { text: "Segunda", start: 1300, end: 1600, confidence: 0.9 },
      { text: "frase.", start: 1620, end: 1900, confidence: 0.9 },
    ];
    expect(agruparPalavrasEmSegmentos(palavras)).toEqual([
      { startMs: 0, endMs: 600, text: "Primeira frase." },
      { startMs: 1300, endMs: 1900, text: "Segunda frase." },
    ]);
  });

  it("quebra em nova cue depois de 8 palavras mesmo sem pausa", () => {
    const palavras = Array.from({ length: 10 }, (_, i) => ({
      text: `p${i}`,
      start: i * 100,
      end: i * 100 + 90,
      confidence: 0.9,
    }));
    const segmentos = agruparPalavrasEmSegmentos(palavras);
    expect(segmentos).toHaveLength(2);
    expect(segmentos[0].text).toBe("p0 p1 p2 p3 p4 p5 p6 p7");
    expect(segmentos[1].text).toBe("p8 p9");
  });

  it("devolve lista vazia pra lista de palavras vazia", () => {
    expect(agruparPalavrasEmSegmentos([])).toEqual([]);
  });
});
