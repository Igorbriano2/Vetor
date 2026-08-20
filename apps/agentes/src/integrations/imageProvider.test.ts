import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { gerarImagem, gerarImagemComReferencia, ImagemIndisponivelError } from "./imageProvider.js";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function respostaOpenAI(b64: string) {
  return { ok: true, json: async () => ({ data: [{ b64_json: b64 }] }) };
}

function respostaGemini(b64: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] }),
  };
}

describe("gerarImagem (provider gateway + fallback)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["OPENAI_API_KEY", "GEMINI_API_KEY", "IMAGE_PROVIDER"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.OPENAI_API_KEY = "sk-teste";
    process.env.GEMINI_API_KEY = "gemini-teste";
    delete process.env.IMAGE_PROVIDER;
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("lança ImagemIndisponivelError quando nenhum provider está configurado", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await expect(gerarImagem("uma logo minimalista")).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });

  it("decodifica o b64_json retornado pela OpenAI (provider padrão) em bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respostaOpenAI(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagem("post de feed com combo");
    expect(resultado.mimeType).toBe("image/png");
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("openai.com");
  });

  it("mapeia aspect_ratio pra o tamanho suportado pela OpenAI", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOpenAI(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    await gerarImagem("story vertical", { aspectRatio: "9:16" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.size).toBe("1024x1536");
    expect(body.model).toBe("gpt-image-1");
  });

  it("cai pro Gemini (Nano Banana) quando a OpenAI falha, sem derrubar a chamada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 402, text: async () => "insufficient credits" })
      .mockResolvedValueOnce(respostaGemini(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagem("post de feed com combo");
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("openai.com");
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain("generativelanguage.googleapis.com");
  });

  it("usa direto o Gemini quando é o provider preferido (nunca chama a OpenAI antes)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respostaGemini(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagem("post de feed com combo", { provider: "gemini" });
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("generativelanguage.googleapis.com");
  });

  it("usa só o provider disponível quando o outro não tem chave configurada", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn().mockResolvedValueOnce(respostaGemini(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagem("post de feed com combo");
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("generativelanguage.googleapis.com");
  });

  it("propaga erro como ImagemIndisponivelError quando os dois providers falham", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "invalid api key" })
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "invalid api key" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(gerarImagem("teste")).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });
});

describe("gerarImagemComReferencia (image-to-image real com logo/asset do Drive)", () => {
  const originais: Record<string, string | undefined> = {};
  const chaves = ["OPENAI_API_KEY", "GEMINI_API_KEY", "IMAGE_PROVIDER"];

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
    process.env.OPENAI_API_KEY = "sk-teste";
    process.env.GEMINI_API_KEY = "gemini-teste";
    delete process.env.IMAGE_PROVIDER;
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
    vi.unstubAllGlobals();
  });

  it("chama /v1/images/edits (não /generations) quando há referência real, provider padrão", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respostaOpenAI(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    await gerarImagemComReferencia("post com a logo aplicada", [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/images/edits");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("envia as referências como partes de imagem inline pro Gemini", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respostaGemini(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    await gerarImagemComReferencia(
      "post com a logo aplicada",
      [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }],
      { provider: "gemini" },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].inlineData.data).toBe(png1x1.toString("base64"));
  });

  it("lança erro se chamado sem nenhuma referência (nunca finge que compôs sem arquivo real)", async () => {
    await expect(gerarImagemComReferencia("teste", [])).rejects.toBeInstanceOf(ImagemIndisponivelError);
  });

  it("cai pro Gemini quando a edição via OpenAI falha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad request" })
      .mockResolvedValueOnce(respostaGemini(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagemComReferencia("teste", [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }]);
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("decodifica o resultado em bytes normalmente", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respostaOpenAI(png1x1.toString("base64")));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await gerarImagemComReferencia("teste", [{ bytes: png1x1, mimeType: "image/png", nome: "logo.png" }]);
    expect(resultado.bytes.equals(png1x1)).toBe(true);
    expect(resultado.mimeType).toBe("image/png");
  });
});
