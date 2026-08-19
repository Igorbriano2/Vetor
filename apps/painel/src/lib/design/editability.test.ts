import { describe, expect, it } from "vitest";
import { avaliarEditabilidade } from "./editability";

describe("avaliarEditabilidade", () => {
  it("identifica um PNG antigo (sem vetorMeta.role nenhum) como flat_image_legacy", () => {
    const canvasAntigo = { objects: [{ type: "image", src: "x.png" }] };
    expect(avaliarEditabilidade(canvasAntigo)).toEqual({ editabilityStatus: "flat_image_legacy", editableLayerCount: 0, migrationAvailable: true });
  });

  it("identifica um projeto só com fundo+logo como flat_image_legacy (logo sozinha não é camada editável de copy)", () => {
    const canvas = { objects: [{ vetorMeta: { role: "fundo" } }, { vetorMeta: { role: "logo", isOfficialLogo: true } }] };
    expect(avaliarEditabilidade(canvas).editabilityStatus).toBe("flat_image_legacy");
  });

  it("identifica um projeto com texto real como editable_layers", () => {
    const canvas = { objects: [{ vetorMeta: { role: "fundo" } }, { vetorMeta: { role: "texto", field: "headline" } }] };
    const resultado = avaliarEditabilidade(canvas);
    expect(resultado.editabilityStatus).toBe("editable_layers");
    expect(resultado.editableLayerCount).toBe(1);
  });

  it("canvasJson vazio/malformado nunca lança erro", () => {
    expect(avaliarEditabilidade({}).editabilityStatus).toBe("flat_image_legacy");
    expect(avaliarEditabilidade(null).editabilityStatus).toBe("flat_image_legacy");
    expect(avaliarEditabilidade(undefined).editabilityStatus).toBe("flat_image_legacy");
  });
});
