import { describe, expect, it } from "vitest";
import { dimensaoDoTamanhoOpenAI, montarCanvasJsonInicial } from "./designProjects.js";

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
