import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  gerarProxyDeVideo,
  analisarVideoDeReferencia,
  renderizarVideoFinal,
  renderizarVideoFinalMultiClip,
  RenderServiceIndisponivelError,
} from "./renderService.js";

describe("gerarProxyDeVideo (cliente do serviço de render)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["RENDER_SERVICE_URL", "INTERNAL_API_TOKEN"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.RENDER_SERVICE_URL = "https://vetor-render.example";
    process.env.INTERNAL_API_TOKEN = "token-teste";
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("lança RenderServiceIndisponivelError sem RENDER_SERVICE_URL configurada", async () => {
    delete process.env.RENDER_SERVICE_URL;
    await expect(gerarProxyDeVideo({ bucket: "uploads", storagePath: "x", clienteId: "y" })).rejects.toBeInstanceOf(
      RenderServiceIndisponivelError,
    );
  });

  it("lança RenderServiceIndisponivelError sem INTERNAL_API_TOKEN configurado", async () => {
    delete process.env.INTERNAL_API_TOKEN;
    await expect(gerarProxyDeVideo({ bucket: "uploads", storagePath: "x", clienteId: "y" })).rejects.toBeInstanceOf(
      RenderServiceIndisponivelError,
    );
  });

  it("envia o x-internal-token e devolve o resultado real em caso de sucesso", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bucket: "artifacts", storagePath: "cliente/video/proxy/x.mp4", bytes: 12345, durationMs: 4200 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarProxyDeVideo({ bucket: "uploads", storagePath: "cliente/x.mov", clienteId: "cliente" });

    expect(resultado.durationMs).toBe(4200);
    expect(resultado.storagePath).toBe("cliente/video/proxy/x.mp4");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://vetor-render.example/render/proxy");
    expect((init.headers as Record<string, string>)["x-internal-token"]).toBe("token-teste");
  });

  it("propaga erro do serviço como RenderServiceIndisponivelError, nunca deixa vazar erro cru", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(gerarProxyDeVideo({ bucket: "uploads", storagePath: "x", clienteId: "y" })).rejects.toBeInstanceOf(
      RenderServiceIndisponivelError,
    );
  });
});

describe("analisarVideoDeReferencia (cliente do serviço de render)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["RENDER_SERVICE_URL", "INTERNAL_API_TOKEN"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.RENDER_SERVICE_URL = "https://vetor-render.example";
    process.env.INTERNAL_API_TOKEN = "token-teste";
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("envia o x-internal-token pro endpoint certo e devolve o sinal bruto real", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        durationMs: 35067,
        width: 1080,
        height: 1920,
        cutsMs: [0, 2500, 7810],
        meanVolumeDb: -18.3,
        frames: [{ atMs: 5000, dataUrl: "data:image/jpeg;base64,xyz" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await analisarVideoDeReferencia({ bucket: "brand-assets", storagePath: "cliente/ref.mp4" });

    expect(resultado.durationMs).toBe(35067);
    expect(resultado.cutsMs).toEqual([0, 2500, 7810]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://vetor-render.example/render/analisar-referencia");
    expect((init.headers as Record<string, string>)["x-internal-token"]).toBe("token-teste");
  });

  it("propaga erro do serviço como RenderServiceIndisponivelError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(analisarVideoDeReferencia({ bucket: "brand-assets", storagePath: "x" })).rejects.toBeInstanceOf(
      RenderServiceIndisponivelError,
    );
  });
});

describe("renderizarVideoFinal (cliente do serviço de render)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["RENDER_SERVICE_URL", "INTERNAL_API_TOKEN"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.RENDER_SERVICE_URL = "https://vetor-render.example";
    process.env.INTERNAL_API_TOKEN = "token-teste";
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("envia o x-internal-token pro endpoint /render/final e devolve o resultado real", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bucket: "artifacts", storagePath: "cliente/video/final/x.mp4", bytes: 98765, durationMs: 35067 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await renderizarVideoFinal({
      bucket: "uploads",
      storagePath: "cliente/original.mp4",
      clienteId: "cliente",
      trimInMs: 0,
      trimOutMs: 35067,
      captions: [{ startMs: 0, endMs: 1000, text: "Olá" }],
    });

    expect(resultado.storagePath).toBe("cliente/video/final/x.mp4");
    expect(resultado.durationMs).toBe(35067);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://vetor-render.example/render/final");
    expect((init.headers as Record<string, string>)["x-internal-token"]).toBe("token-teste");
  });

  it("propaga erro do serviço como RenderServiceIndisponivelError, nunca finge um render que não rodou", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "ffmpeg falhou" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      renderizarVideoFinal({ bucket: "uploads", storagePath: "x", clienteId: "y", trimInMs: 0, trimOutMs: 1000 }),
    ).rejects.toBeInstanceOf(RenderServiceIndisponivelError);
  });
});

describe("renderizarVideoFinalMultiClip (cliente do serviço de render — job assíncrono)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["RENDER_SERVICE_URL", "INTERNAL_API_TOKEN"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.RENDER_SERVICE_URL = "https://vetor-render.example";
    process.env.INTERNAL_API_TOKEN = "token-teste";
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const paramsBase = {
    clienteId: "cliente",
    clipes: [{ bucket: "uploads" as const, storagePath: "a.mp4", tipo: "video" as const, trimInMs: 0, trimOutMs: 2000 }],
    width: 1080,
    height: 1920,
    fps: 30,
  };

  // Achado ao vivo (2026-08-28): a rota costumava segurar 1 requisição HTTP
  // até o ffmpeg terminar — em produção isso estourava o timeout fixo do
  // proxy reverso da DO (~60s) mesmo com args corretos. Virou job
  // assíncrono: POST cria o job e responde na hora, GET faz polling. Este
  // teste garante que o cliente nunca mais segura 1 única requisição —
  // sempre cria + faz polling, mesmo quando o job termina rápido.
  it("cria o job via POST e faz polling via GET até status \"done\", devolvendo o resultado real", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: "job-1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "processing" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "done",
          result: { bucket: "artifacts", storagePath: "cliente/video/final/x.mp4", bytes: 98765, durationMs: 6000 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = renderizarVideoFinalMultiClip(paramsBase);
    await vi.runAllTimersAsync();
    const resultado = await promessa;

    expect(resultado.storagePath).toBe("cliente/video/final/x.mp4");
    expect(resultado.durationMs).toBe(6000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [postUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(postUrl).toBe("https://vetor-render.example/render/final-multi-clip");
    const [getUrl, getInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(getUrl).toBe("https://vetor-render.example/render/final-multi-clip/job-1");
    expect((getInit.headers as Record<string, string>)["x-internal-token"]).toBe("token-teste");
  });

  it("propaga status \"failed\" do job como RenderServiceIndisponivelError com o erro real", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: "job-2" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "failed", error: "ffmpeg travou de verdade" }) });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = renderizarVideoFinalMultiClip(paramsBase);
    // Anexa o handler de rejeição ANTES de avançar os timers — senão a
    // promise rejeita durante runAllTimersAsync() sem ninguém ainda
    // "ouvindo", e o Node reporta unhandled rejection mesmo com o teste
    // passando.
    const expectativa = expect(promessa).rejects.toThrow("ffmpeg travou de verdade");
    await vi.runAllTimersAsync();
    await expectativa;
  });

  it("propaga erro do serviço como RenderServiceIndisponivelError se a criação do job falhar mesmo após a tentativa extra", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = renderizarVideoFinalMultiClip(paramsBase);
    const expectativa = expect(promessa).rejects.toBeInstanceOf(RenderServiceIndisponivelError);
    await vi.runAllTimersAsync();
    await expectativa;
    // 2 tentativas (original + a extra do comUmaTentativaExtra) — nunca
    // desiste na primeira falha, mas também nunca insiste pra sempre.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uma falha transitória isolada na criação do job (ex: deploy em andamento) não derruba o render — a tentativa extra recupera", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "upstream_reset_before_response_started" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: "job-3" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "done",
          result: { bucket: "artifacts", storagePath: "cliente/video/final/y.mp4", bytes: 111, durationMs: 4000 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = renderizarVideoFinalMultiClip(paramsBase);
    await vi.runAllTimersAsync();
    const resultado = await promessa;

    expect(resultado.storagePath).toBe("cliente/video/final/y.mp4");
  });
});
