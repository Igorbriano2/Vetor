import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sintetizarFala, montarCadeiaDeProvedores, SinteseVozIndisponivelError } from "./tts.js";

describe("sintetizarFala", () => {
  const chaves = ["TTS_PROVIDER", "OPENAI_API_KEY", "FISH_AUDIO_API_KEY", "FISH_AUDIO_VOICE_ID"];
  const originais: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const chave of chaves) {
      originais[chave] = process.env[chave];
      delete process.env[chave];
    }
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("lanca SinteseVozIndisponivelError em modo sandbox (padrao)", async () => {
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
  });

  it("lanca SinteseVozIndisponivelError para provedor desconhecido", async () => {
    process.env.TTS_PROVIDER = "elevenlabs-nao-suportado";
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
  });

  it("lanca SinteseVozIndisponivelError quando openai sem chave configurada", async () => {
    process.env.TTS_PROVIDER = "openai";
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
  });

  it("lanca SinteseVozIndisponivelError quando fish e o fallback openai estao ambos indisponiveis", async () => {
    process.env.TTS_PROVIDER = "fish";
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
  });

  it("cai pro fallback openai quando fish esta mal configurado (sem voice id) mas openai esta disponivel", async () => {
    process.env.TTS_PROVIDER = "fish";
    process.env.FISH_AUDIO_API_KEY = "chave-de-teste";
    process.env.OPENAI_API_KEY = "chave-openai";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await sintetizarFala("oi");

    expect(resultado.mimeType).toBe("audio/ogg");
    // Só uma chamada de rede — direto pra OpenAI, nunca tentou chamar a Fish
    // Audio de verdade (ela nem estava "disponivel").
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("openai.com");
  });

  it("cai pro fallback openai quando a Fish Audio esta configurada mas a chamada real falha", async () => {
    process.env.TTS_PROVIDER = "fish";
    process.env.FISH_AUDIO_API_KEY = "chave-de-teste";
    process.env.FISH_AUDIO_VOICE_ID = "voz-clonada";
    process.env.OPENAI_API_KEY = "chave-openai";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "fora do ar" })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await sintetizarFala("oi");

    expect(resultado.mimeType).toBe("audio/ogg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("fish.audio");
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain("openai.com");
  });

  it("usa a Fish Audio direto (sem fallback) quando ela esta configurada e funciona", async () => {
    process.env.TTS_PROVIDER = "fish";
    process.env.FISH_AUDIO_API_KEY = "chave-de-teste";
    process.env.FISH_AUDIO_VOICE_ID = "voz-clonada";
    process.env.OPENAI_API_KEY = "chave-openai";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    vi.stubGlobal("fetch", fetchMock);

    await sintetizarFala("oi");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("fish.audio");
  });
});

describe("montarCadeiaDeProvedores", () => {
  it("fish tem openai como fallback", () => {
    expect(montarCadeiaDeProvedores("fish").map((p) => p.nome)).toEqual(["fish", "openai"]);
  });

  it("openai não tem fallback (nunca cai pra fish de outro tenant)", () => {
    expect(montarCadeiaDeProvedores("openai").map((p) => p.nome)).toEqual(["openai"]);
  });

  it("provider desconhecido/undefined vira cadeia vazia", () => {
    expect(montarCadeiaDeProvedores(undefined)).toEqual([]);
    expect(montarCadeiaDeProvedores("sandbox")).toEqual([]);
  });
});
