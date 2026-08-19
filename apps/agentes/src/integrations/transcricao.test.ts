import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { extensaoParaTranscricao, transcreverComTimestamps, TranscricaoIndisponivelError } from "./transcricao.js";

describe("extensaoParaTranscricao", () => {
  it("reconhece webm (MediaRecorder do navegador — assistente de voz)", () => {
    expect(extensaoParaTranscricao("audio/webm;codecs=opus")).toBe("webm");
    expect(extensaoParaTranscricao("audio/webm")).toBe("webm");
  });

  it("reconhece ogg (áudio de voz do WhatsApp)", () => {
    expect(extensaoParaTranscricao("audio/ogg; codecs=opus")).toBe("ogg");
  });

  it("reconhece mp4, mp3/mpeg, wav, m4a, flac", () => {
    expect(extensaoParaTranscricao("audio/mp4")).toBe("mp4");
    expect(extensaoParaTranscricao("audio/mpeg")).toBe("mp3");
    expect(extensaoParaTranscricao("audio/mp3")).toBe("mp3");
    expect(extensaoParaTranscricao("audio/wav")).toBe("wav");
    expect(extensaoParaTranscricao("audio/m4a")).toBe("m4a");
    expect(extensaoParaTranscricao("audio/flac")).toBe("flac");
  });

  it("nunca cai em 'bin' — mime type desconhecido usa webm como melhor chute, nunca um formato que a OpenAI rejeita", () => {
    expect(extensaoParaTranscricao("application/octet-stream")).toBe("webm");
    expect(extensaoParaTranscricao("")).toBe("webm");
  });
});

describe("transcreverComTimestamps (Videomaker — captions com timing real)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["STT_PROVIDER", "OPENAI_API_KEY"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("modo sandbox lança TranscricaoIndisponivelError, nunca inventa segmentos", async () => {
    delete process.env.STT_PROVIDER;
    await expect(transcreverComTimestamps(new ArrayBuffer(10), "video/mp4")).rejects.toBeInstanceOf(TranscricaoIndisponivelError);
  });

  it("provider != openai lança TranscricaoIndisponivelError", async () => {
    process.env.STT_PROVIDER = "outro";
    await expect(transcreverComTimestamps(new ArrayBuffer(10), "video/mp4")).rejects.toBeInstanceOf(TranscricaoIndisponivelError);
  });

  it("sem OPENAI_API_KEY lança TranscricaoIndisponivelError mesmo com STT_PROVIDER=openai", async () => {
    process.env.STT_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    await expect(transcreverComTimestamps(new ArrayBuffer(10), "video/mp4")).rejects.toBeInstanceOf(TranscricaoIndisponivelError);
  });

  it("converte segments (start/end em segundos) da OpenAI pra startMs/endMs reais", async () => {
    process.env.STT_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-teste";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        segments: [
          { start: 0, end: 1.5, text: " Olá mundo " },
          { start: 1.5, end: 3.2, text: "segunda fala" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const segmentos = await transcreverComTimestamps(new ArrayBuffer(10), "video/mp4");

    expect(segmentos).toEqual([
      { startMs: 0, endMs: 1500, text: "Olá mundo" },
      { startMs: 1500, endMs: 3200, text: "segunda fala" },
    ]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    expect(body.get("response_format")).toBe("verbose_json");
    expect(body.get("timestamp_granularities[]")).toBe("segment");
  });

  it("sem fala detectável (segments ausente) devolve array vazio, não erro", async () => {
    process.env.STT_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-teste";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const segmentos = await transcreverComTimestamps(new ArrayBuffer(10), "video/mp4");
    expect(segmentos).toEqual([]);
  });

  it("propaga falha real da OpenAI como erro, nunca finge sucesso", async () => {
    process.env.STT_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-teste";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcreverComTimestamps(new ArrayBuffer(10), "video/mp4")).rejects.toThrow();
  });
});
