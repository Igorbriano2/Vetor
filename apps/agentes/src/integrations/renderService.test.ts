import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { gerarProxyDeVideo, analisarVideoDeReferencia, RenderServiceIndisponivelError } from "./renderService.js";

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
