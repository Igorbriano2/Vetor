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
});
