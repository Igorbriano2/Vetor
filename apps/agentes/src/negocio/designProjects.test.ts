import { describe, expect, it } from "vitest";
import { dimensaoDoTamanhoOpenAI, lerDimensaoDeImagem, montarCanvasJsonInicial, montarCanvasJsonEmCamadas, avaliarEditabilidade } from "./designProjects.js";
import type { EspecificacaoDeCamada } from "./designLayout.js";

function construirPngFake(width: number, height: number): Buffer {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length do chunk
  ihdr.write("IHDR", 4, "ascii");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  return Buffer.concat([assinatura, ihdr]);
}

function construirJpegFake(width: number, height: number): Buffer {
  const sof0 = Buffer.alloc(9);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(8, 2); // length do segmento (não conta os 2 bytes do marcador)
  sof0[4] = 8; // precisão
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof0]);
}

describe("dimensaoDoTamanhoOpenAI", () => {
  it("converte o tamanho da OpenAI (WxH) em width/height numéricos", () => {
    expect(dimensaoDoTamanhoOpenAI("1024x1536")).toEqual({ width: 1024, height: 1536 });
    expect(dimensaoDoTamanhoOpenAI("1536x1024")).toEqual({ width: 1536, height: 1024 });
    expect(dimensaoDoTamanhoOpenAI("1024x1024")).toEqual({ width: 1024, height: 1024 });
  });

  it("cai pra 1024x1024 se o formato vier inesperado", () => {
    expect(dimensaoDoTamanhoOpenAI("")).toEqual({ width: 1024, height: 1024 });
  });
});

describe("montarCanvasJsonInicial", () => {
  it("monta o fundo ocupando o canvas inteiro, sem logo quando nenhuma é passada", () => {
    const canvas = montarCanvasJsonInicial({
      fundo: { storagePath: "cliente-1/design/etapa-1/req-1.png", bucket: "artifacts", naturalWidth: 1024, naturalHeight: 1024 },
      canvasWidth: 1024,
      canvasHeight: 1024,
    }) as { objects: Array<Record<string, unknown>> };

    expect(canvas.objects).toHaveLength(1);
    const fundo = canvas.objects[0];
    expect(fundo.type).toBe("image");
    expect(fundo.scaleX).toBe(1);
    expect(fundo.scaleY).toBe(1);
    expect((fundo.vetorMeta as Record<string, unknown>).storagePath).toBe("cliente-1/design/etapa-1/req-1.png");
    expect((fundo.vetorMeta as Record<string, unknown>).bucket).toBe("artifacts");
  });

  it("adiciona a logo travada (lock* true, hasControls/editable false) quando presente", () => {
    const canvas = montarCanvasJsonInicial({
      fundo: { storagePath: "cliente-1/design/etapa-1/req-1.png", bucket: "artifacts", naturalWidth: 1080, naturalHeight: 1080 },
      canvasWidth: 1080,
      canvasHeight: 1080,
      logo: { assetId: "logo-1", storagePath: "cliente-1/brandkit/logo.png", naturalWidth: 500, naturalHeight: 200 },
    }) as { objects: Array<Record<string, unknown>> };

    expect(canvas.objects).toHaveLength(2);
    const logo = canvas.objects[1];
    expect(logo.lockMovementX).toBe(true);
    expect(logo.lockMovementY).toBe(true);
    expect(logo.lockScalingX).toBe(true);
    expect(logo.lockScalingY).toBe(true);
    expect(logo.lockRotation).toBe(true);
    expect(logo.hasControls).toBe(false);
    expect(logo.editable).toBe(false);
    const meta = logo.vetorMeta as Record<string, unknown>;
    expect(meta.isOfficialLogo).toBe(true);
    expect(meta.assetId).toBe("logo-1");
    expect(meta.bucket).toBe("brand-assets");

    // logo nunca maior que ~20% da largura do canvas (regra da spec)
    const larguraLogoEscalada = (logo.width as number) * (logo.scaleX as number);
    expect(larguraLogoEscalada).toBeLessThanOrEqual(1080 * 0.2);
  });

  it("mantém a proporção real da logo (não distorce)", () => {
    const canvas = montarCanvasJsonInicial({
      fundo: { storagePath: "x", bucket: "artifacts", naturalWidth: 1000, naturalHeight: 1000 },
      canvasWidth: 1000,
      canvasHeight: 1000,
      logo: { assetId: "logo-2", storagePath: "y", naturalWidth: 400, naturalHeight: 100 },
    }) as { objects: Array<Record<string, unknown>> };

    const logo = canvas.objects[1];
    const proporcaoOriginal = 400 / 100;
    const proporcaoRenderizada = ((logo.width as number) * (logo.scaleX as number)) / ((logo.height as number) * (logo.scaleY as number));
    expect(proporcaoRenderizada).toBeCloseTo(proporcaoOriginal, 5);
  });
});

describe("lerDimensaoDeImagem", () => {
  it("lê width/height reais de um PNG (achado ao vivo: nunca confiar em business_assets.width/height nulo)", () => {
    expect(lerDimensaoDeImagem(construirPngFake(500, 200))).toEqual({ width: 500, height: 200 });
  });

  it("lê width/height reais de um JPEG (marcador SOF0)", () => {
    expect(lerDimensaoDeImagem(construirJpegFake(800, 450))).toEqual({ width: 800, height: 450 });
  });

  it("devolve null pra um formato não reconhecido, em vez de inventar dimensão (nunca força distorção)", () => {
    expect(lerDimensaoDeImagem(Buffer.from("não é uma imagem"))).toBeNull();
  });

  it("decodifica corretamente o PNG 1x1 real usado nos testes do imageProvider", () => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    expect(lerDimensaoDeImagem(png1x1)).toEqual({ width: 1, height: 1 });
  });
});

const CAMADA_FUNDO: EspecificacaoDeCamada = {
  tipo: "imagem",
  role: "fundo",
  source: "generated",
  storagePath: "cliente-1/design/req-1/fundo.png",
  bucket: "artifacts",
  bytes: Buffer.from([]),
  naturalWidth: 1080,
  naturalHeight: 1080,
  x: 0,
  y: 0,
  width: 1080,
  height: 1080,
};

const CAMADA_HEADLINE: EspecificacaoDeCamada = {
  tipo: "texto",
  field: "headline",
  texto: "Combo Dog Bacon",
  x: 60,
  y: 80,
  width: 960,
  fontSize: 64,
  fontFamily: "sans",
  fontWeight: "bold",
  fill: "#ffffff",
  textAlign: "left",
  required: true,
};

const CAMADA_LOGO: EspecificacaoDeCamada = {
  tipo: "logo",
  assetId: "logo-1",
  storagePath: "cliente-1/brandkit/logo.png",
  bucket: "brand-assets",
  bytes: Buffer.from([]),
  naturalWidth: 400,
  naturalHeight: 100,
  x: 800,
  y: 950,
  width: 200,
  height: 50,
};

const CAMADA_PRODUTO: EspecificacaoDeCamada = {
  tipo: "imagem",
  role: "produto",
  source: "drive",
  assetId: "produto-1",
  storagePath: "cliente-1/drive/produto.png",
  bucket: "brand-assets",
  bytes: Buffer.from([]),
  naturalWidth: 500,
  naturalHeight: 500,
  x: 300,
  y: 400,
  width: 480,
  height: 480,
};

describe("montarCanvasJsonEmCamadas", () => {
  it("cria um objeto Fabric independente por camada — texto nunca vira pixel do fundo", () => {
    const canvas = montarCanvasJsonEmCamadas({
      canvasWidth: 1080,
      canvasHeight: 1080,
      corDeFundo: "#ffffff",
      camadas: [CAMADA_FUNDO, CAMADA_PRODUTO, CAMADA_HEADLINE, CAMADA_LOGO],
    }) as { objects: Array<Record<string, unknown>> };

    expect(canvas.objects).toHaveLength(4);

    const headline = canvas.objects.find((o) => (o.vetorMeta as Record<string, unknown>).field === "headline")!;
    expect(headline.type).toBe("textbox");
    expect(headline.text).toBe("Combo Dog Bacon");
    expect((headline.vetorMeta as Record<string, unknown>).editable).toBe(true);
    expect((headline.vetorMeta as Record<string, unknown>).role).toBe("texto");

    const produto = canvas.objects.find((o) => (o.vetorMeta as Record<string, unknown>).role === "produto")!;
    expect(produto.type).toBe("image");
    expect((produto.vetorMeta as Record<string, unknown>).source).toBe("drive");
    expect((produto.vetorMeta as Record<string, unknown>).assetId).toBe("produto-1");
  });

  it("logo continua travada por padrão, como no fluxo antigo", () => {
    const canvas = montarCanvasJsonEmCamadas({
      canvasWidth: 1080,
      canvasHeight: 1080,
      corDeFundo: "#ffffff",
      camadas: [CAMADA_FUNDO, CAMADA_LOGO],
    }) as { objects: Array<Record<string, unknown>> };

    const logo = canvas.objects.find((o) => (o.vetorMeta as Record<string, unknown>).isOfficialLogo)!;
    expect(logo.lockMovementX).toBe(true);
    expect(logo.hasControls).toBe(false);
    expect((logo.vetorMeta as Record<string, unknown>).editable).toBe(false);
  });

  it("nunca cria uma camada de texto vazia quando o campo não foi pedido", () => {
    const canvas = montarCanvasJsonEmCamadas({
      canvasWidth: 1080,
      canvasHeight: 1080,
      corDeFundo: "#ffffff",
      camadas: [CAMADA_FUNDO],
    }) as { objects: Array<Record<string, unknown>> };

    expect(canvas.objects).toHaveLength(1);
    expect(canvas.objects.some((o) => o.type === "textbox")).toBe(false);
  });
});

describe("avaliarEditabilidade", () => {
  it("identifica como flat_image_legacy um projeto só com fundo (sem nenhum texto/forma/imagem adicional)", () => {
    const canvas = montarCanvasJsonEmCamadas({ canvasWidth: 1080, canvasHeight: 1080, corDeFundo: "#fff", camadas: [CAMADA_FUNDO] });
    expect(avaliarEditabilidade(canvas)).toEqual({ editabilityStatus: "flat_image_legacy", editableLayerCount: 0, migrationAvailable: true });
  });

  it("identifica como flat_image_legacy um projeto só com fundo + logo (logo sozinha não conta como camada editável)", () => {
    const canvas = montarCanvasJsonEmCamadas({ canvasWidth: 1080, canvasHeight: 1080, corDeFundo: "#fff", camadas: [CAMADA_FUNDO, CAMADA_LOGO] });
    expect(avaliarEditabilidade(canvas).editabilityStatus).toBe("flat_image_legacy");
  });

  it("identifica como editable_layers um projeto com pelo menos uma camada de texto/imagem real", () => {
    const canvas = montarCanvasJsonEmCamadas({
      canvasWidth: 1080,
      canvasHeight: 1080,
      corDeFundo: "#fff",
      camadas: [CAMADA_FUNDO, CAMADA_HEADLINE, CAMADA_LOGO],
    });
    const resultado = avaliarEditabilidade(canvas);
    expect(resultado.editabilityStatus).toBe("editable_layers");
    expect(resultado.editableLayerCount).toBe(1);
    expect(resultado.migrationAvailable).toBe(false);
  });

  it("um canvasJson vazio/malformado (projeto muito antigo) nunca lança erro, só reporta honestamente", () => {
    expect(avaliarEditabilidade({})).toEqual({ editabilityStatus: "flat_image_legacy", editableLayerCount: 0, migrationAvailable: false });
    expect(avaliarEditabilidade(null)).toEqual({ editabilityStatus: "flat_image_legacy", editableLayerCount: 0, migrationAvailable: false });
  });
});
