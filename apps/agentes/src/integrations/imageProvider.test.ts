import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { gerarImagem, gerarImagemComReferencia, ImagemIndisponivelError } from "./imageProvider.js";

describe("gerarImagem (provider gateway)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["OPENAI_API_KEY", "IMAGE_PROVIDER"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.OPENAI_API_KEY = "sk-teste";
    delete process.env.IMAGE_PROVIDER;
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("lança ImagemIndisponivelError sem OPENAI_API_KEY configurada", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(gerarImagem("uma logo minimalista")).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });

  it("decodifica o b64_json retornado pela OpenAI em bytes", async () => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: png1x1.toString("base64") }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagem("post de feed com combo");
    expect(resultado.mimeType).toBe("image/png");
    expect(resultado.bytes.equals(png1x1)).toBe(true);
  });

  it("mapeia aspect_ratio pra o tamanho suportado pela OpenAI", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: Buffer.from("x").toString("base64") }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await gerarImagem("story vertical", { aspectRatio: "9:16" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.size).toBe("1024x1536");
    expect(body.model).toBe("gpt-image-1");
  });

  it("propaga erro da API como ImagemIndisponivelError, não deixa vazar erro cru", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 401, text: async () => "invalid api key" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(gerarImagem("teste")).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });

  it("falha fechado quando IMAGE_PROVIDER aponta pra um provider não suportado", async () => {
    process.env.IMAGE_PROVIDER = "provider-inexistente";
    await expect(gerarImagem("teste")).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });
});

describe("gerarImagemComReferencia (image-to-image real com logo/asset do Drive)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["OPENAI_API_KEY", "IMAGE_PROVIDER"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.OPENAI_API_KEY = "sk-teste";
    delete process.env.IMAGE_PROVIDER;
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  it("chama /v1/images/edits (não /generations) quando há referência real", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: png1x1.toString("base64") }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await gerarImagemComReferencia("post com a logo aplicada", [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/images/edits");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("lança erro se chamado sem nenhuma referência (nunca finge que compôs sem arquivo real)", async () => {
    await expect(gerarImagemComReferencia("teste", [])).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });

  it("propaga erro da API de edição como ImagemIndisponivelError", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad request" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      gerarImagemComReferencia("teste", [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }]),
    ).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });

  it("decodifica o resultado em bytes normalmente", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: png1x1.toString("base64") }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagemComReferencia("teste", [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }]);
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect(resultado.mimeType).toBe("image/png");
  });
});
