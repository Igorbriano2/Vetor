import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockDownload = vi.fn();
const mockAssetsIn = vi.fn();

vi.mock("../db/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload, createSignedUrl: mockCreateSignedUrl, download: mockDownload }),
    },
    from: () => ({ select: () => ({ in: mockAssetsIn }) }),
  },
}));

const mockGerarImagem = vi.fn();
const mockGerarImagemComReferencia = vi.fn();

vi.mock("../integrations/imageProvider.js", () => ({
  gerarImagem: (...args: unknown[]) => mockGerarImagem(...args),
  gerarImagemComReferencia: (...args: unknown[]) => mockGerarImagemComReferencia(...args),
}));

const { ImageAdapter, MODELO_IMAGEM_PADRAO } = await import("./imageAdapter.js");

describe("ImageAdapter", () => {
  const modelo = MODELO_IMAGEM_PADRAO;

  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://storage.example/imagem.png" }, error: null });
    mockDownload.mockReset();
    mockAssetsIn.mockReset().mockResolvedValue({ data: [] });
    mockGerarImagem.mockReset().mockResolvedValue({ bytes: Buffer.from("fake-png"), mimeType: "image/png" });
    mockGerarImagemComReferencia.mockReset().mockResolvedValue({ bytes: Buffer.from("fake-png"), mimeType: "image/png" });
  });

  it("generate sem referência chama gerarImagem (texto puro) e getJobStatus devolve 'done' com a URL real", async () => {
    const adapter = new ImageAdapter();
    const { jobId } = await adapter.generate({ kind: "image", modelId: modelo.id, prompt: "foto de hambúrguer" }, modelo);
    expect(mockGerarImagem).toHaveBeenCalledTimes(1);
    expect(mockGerarImagemComReferencia).not.toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalledTimes(1);

    const status = await adapter.getJobStatus(jobId);
    expect(status.status).toBe("done");
    expect(status.resultAssetUrls).toEqual(["https://storage.example/imagem.png"]);
  });

  it("generate sem prompt lança erro claro, nunca chama o provider", async () => {
    const adapter = new ImageAdapter();
    await expect(adapter.generate({ kind: "image", modelId: modelo.id, prompt: "   " }, modelo)).rejects.toThrow(/Descreva/);
    expect(mockGerarImagem).not.toHaveBeenCalled();
  });

  it("com referenceAssetIds, baixa o(s) ativo(s) real(is) do storage e chama gerarImagemComReferencia", async () => {
    mockAssetsIn.mockResolvedValue({ data: [{ id: "asset-1", nome: "logo.png", storage_path: "cliente/logo.png" }] });
    mockDownload.mockResolvedValue({ data: { arrayBuffer: async () => new TextEncoder().encode("bytes-do-logo").buffer, type: "image/png" } });

    const adapter = new ImageAdapter();
    await adapter.generate({ kind: "image", modelId: modelo.id, prompt: "peça com a logo", referenceAssetIds: ["asset-1"] }, modelo);

    expect(mockGerarImagemComReferencia).toHaveBeenCalledTimes(1);
    const [, referencias] = mockGerarImagemComReferencia.mock.calls[0] as [string, Array<{ nome: string }>];
    expect(referencias).toHaveLength(1);
    expect(referencias[0]!.nome).toBe("logo.png");
  });

  it("gera 'quantity' variações, uma URL por imagem", async () => {
    mockCreateSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example/1.png" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example/2.png" }, error: null });

    const adapter = new ImageAdapter();
    const { jobId } = await adapter.generate({ kind: "image", modelId: modelo.id, prompt: "duas variações", quantity: 2 }, modelo);
    expect(mockGerarImagem).toHaveBeenCalledTimes(2);

    const status = await adapter.getJobStatus(jobId);
    expect(status.resultAssetUrls).toEqual(["https://storage.example/1.png", "https://storage.example/2.png"]);
  });

  it("falha real do provider nunca finge sucesso nem sobe nada", async () => {
    mockGerarImagem.mockRejectedValue(new Error("sem crédito"));
    const adapter = new ImageAdapter();
    await expect(adapter.generate({ kind: "image", modelId: modelo.id, prompt: "algo" }, modelo)).rejects.toThrow(/sem crédito/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("getJobStatus com jobId inválido nunca finge sucesso — falha explícita", async () => {
    const adapter = new ImageAdapter();
    const status = await adapter.getJobStatus("nao-existe");
    expect(status.status).toBe("failed");
    expect(status.error).toBeTruthy();
  });
});
