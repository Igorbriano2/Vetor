import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sintetizarFala, SinteseVozIndisponivelError } from "./tts.js";

describe("sintetizarFala", () => {
  const originalProvider = process.env.TTS_PROVIDER;

  beforeEach(() => {
    delete process.env.TTS_PROVIDER;
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.TTS_PROVIDER;
    else process.env.TTS_PROVIDER = originalProvider;
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
    delete process.env.OPENAI_API_KEY;
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
  });

  it("lanca SinteseVozIndisponivelError quando fish sem chave configurada", async () => {
    process.env.TTS_PROVIDER = "fish";
    delete process.env.FISH_AUDIO_API_KEY;
    delete process.env.FISH_AUDIO_VOICE_ID;
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
  });

  it("lanca SinteseVozIndisponivelError quando fish sem voice id configurado", async () => {
    process.env.TTS_PROVIDER = "fish";
    process.env.FISH_AUDIO_API_KEY = "chave-de-teste";
    delete process.env.FISH_AUDIO_VOICE_ID;
    await expect(sintetizarFala("oi")).rejects.toBeInstanceOf(SinteseVozIndisponivelError);
    delete process.env.FISH_AUDIO_API_KEY;
  });
});
