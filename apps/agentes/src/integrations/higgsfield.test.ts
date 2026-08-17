import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { gerarVideoAPartirDeImagem, VideoIndisponivelError } from "./higgsfield.js";

describe("gerarVideoAPartirDeImagem", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["HIGGSFIELD_API_KEY_ID", "HIGGSFIELD_API_KEY_SECRET"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.HIGGSFIELD_API_KEY_ID = "id-teste";
    process.env.HIGGSFIELD_API_KEY_SECRET = "secret-teste";
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("lança VideoIndisponivelError sem credenciais configuradas", async () => {
    delete process.env.HIGGSFIELD_API_KEY_ID;
    await expect(gerarVideoAPartirDeImagem("https://x/img.jpg", "anda pra frente")).rejects.toBeInstanceOf(
      VideoIndisponivelError,
    );
  });

  it("retorna a URL direto quando a resposta inicial já vem completed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "completed", request_id: "r1", videos: [{ url: "https://cdn/v1.mp4" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarVideoAPartirDeImagem("https://x/img.jpg", "anda pra frente");
    expect(resultado).toEqual({ url: "https://cdn/v1.mp4", requestId: "r1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("faz polling até completed e extrai a URL do vídeo", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "queued", request_id: "r2", status_url: "https://platform.higgsfield.ai/requests/r2/status" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "processing", request_id: "r2" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "completed", request_id: "r2", videos: [{ url: "https://cdn/v2.mp4" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = gerarVideoAPartirDeImagem("https://x/img.jpg", "zoom lento", { timeoutMs: 30_000 });
    await vi.advanceTimersByTimeAsync(30_000);
    const resultado = await promessa;

    expect(resultado).toEqual({ url: "https://cdn/v2.mp4", requestId: "r2" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("lança erro quando o estado terminal é failed", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "queued", request_id: "r3", status_url: "https://platform.higgsfield.ai/requests/r3/status" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "failed", request_id: "r3", error: "motivo X" }) });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = gerarVideoAPartirDeImagem("https://x/img.jpg", "zoom lento", { timeoutMs: 30_000 });
    const expectativa = expect(promessa).rejects.toThrow(/motivo X/);
    await vi.advanceTimersByTimeAsync(30_000);
    await expectativa;
    vi.useRealTimers();
  });
});
