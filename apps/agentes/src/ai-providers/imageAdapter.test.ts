import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock("../db/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload, createSignedUrl: mockCreateSignedUrl }),
    },
  },
}));

const mockGerarPecaCompostaReal = vi.fn();

vi.mock("../negocio/pecaCompostaReal.js", () => ({
  gerarPecaCompostaReal: (...args: unknown[]) => mockGerarPecaCompostaReal(...args),
}));

const { ImageAdapter, MODELO_IMAGEM_PADRAO } = await import("./imageAdapter.js");

describe("ImageAdapter", () => {
  const modelo = MODELO_IMAGEM_PADRAO;

  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://storage.example/imagem.png" }, error: null });
    mockGerarPecaCompostaReal.mockReset().mockResolvedValue({ bytes: Buffer.from("fake-png"), width: 1024, height: 1024, mimeType: "image/png" });
  });

  it("generate chama gerarPecaCompostaReal (fundo + BrandKit + texto real) e getJobStatus devolve 'done' com a URL real", async () => {
    const adapter = new ImageAdapter();
    const { jobId } = await adapter.generate({ kind: "image", modelId: modelo.id, prompt: "foto de hambúrguer", clienteId: "cliente-1" }, modelo);
    expect(mockGerarPecaCompostaReal).toHaveBeenCalledTimes(1);
    expect(mockGerarPecaCompostaReal).toHaveBeenCalledWith(expect.objectContaining({ clienteId: "cliente-1", promptLivre: "foto de hambúrguer" }));
    expect(mockUpload).toHaveBeenCalledTimes(1);

    const status = await adapter.getJobStatus(jobId);
    expect(status.status).toBe("done");
    expect(status.resultAssetUrls).toEqual(["https://storage.example/imagem.png"]);
  });

  it("generate sem prompt lança erro claro, nunca chama o provider", async () => {
    const adapter = new ImageAdapter();
    await expect(adapter.generate({ kind: "image", modelId: modelo.id, prompt: "   ", clienteId: "cliente-1" }, modelo)).rejects.toThrow(/Descreva/);
    expect(mockGerarPecaCompostaReal).not.toHaveBeenCalled();
  });

  it("generate sem clienteId lança erro claro — nunca gera peça 'genérica' sem saber de quem é", async () => {
    const adapter = new ImageAdapter();
    await expect(adapter.generate({ kind: "image", modelId: modelo.id, prompt: "algo" }, modelo)).rejects.toThrow(/clienteId/);
    expect(mockGerarPecaCompostaReal).not.toHaveBeenCalled();
  });

  it("repassa referenceAssetIds, aspectRatio e provider (extra) pro pipeline de composição", async () => {
    const adapter = new ImageAdapter();
    await adapter.generate(
      { kind: "image", modelId: modelo.id, prompt: "peça com a logo", clienteId: "cliente-1", referenceAssetIds: ["asset-1"], aspectRatio: "9:16", extra: { provider: "gemini" } },
      modelo,
    );
    expect(mockGerarPecaCompostaReal).toHaveBeenCalledWith(
      expect.objectContaining({ assetIds: ["asset-1"], aspectRatio: "9:16", provider: "gemini" }),
    );
  });

  it("gera 'quantity' variações, uma URL por imagem", async () => {
    mockCreateSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example/1.png" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example/2.png" }, error: null });

    const adapter = new ImageAdapter();
    const { jobId } = await adapter.generate({ kind: "image", modelId: modelo.id, prompt: "duas variações", clienteId: "cliente-1", quantity: 2 }, modelo);
    expect(mockGerarPecaCompostaReal).toHaveBeenCalledTimes(2);

    const status = await adapter.getJobStatus(jobId);
    expect(status.resultAssetUrls).toEqual(["https://storage.example/1.png", "https://storage.example/2.png"]);
  });

  it("falha real do pipeline nunca finge sucesso nem sobe nada", async () => {
    mockGerarPecaCompostaReal.mockRejectedValue(new Error("sem crédito"));
    const adapter = new ImageAdapter();
    await expect(adapter.generate({ kind: "image", modelId: modelo.id, prompt: "algo", clienteId: "cliente-1" }, modelo)).rejects.toThrow(/sem crédito/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("getJobStatus com jobId inválido nunca finge sucesso — falha explícita", async () => {
    const adapter = new ImageAdapter();
    const status = await adapter.getJobStatus("nao-existe");
    expect(status.status).toBe("failed");
    expect(status.error).toBeTruthy();
  });
});
