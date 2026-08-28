import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  },
}));

const { extrairCamposDePeca } = await import("./pecaCompostaReal.js");

describe("extrairCamposDePeca", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("decompõe o pedido livre em visual_prompt + campos de texto reais via tool call", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            visual_prompt: "hambúrguer suculento em fundo vermelho vibrante, iluminação de estúdio",
            headline: "Fecha mês",
            subheadline: "dos DKlovers!",
            cta: "Peça já",
            caption: "R$24,99",
            estilo_visual: "product_hero",
          },
        },
      ],
    });

    const campos = await extrairCamposDePeca("Anúncio fecha mês da Dog King com o hambúrguer real em destaque");
    expect(campos.visualPrompt).toContain("fundo vermelho");
    expect(campos.headline).toBe("Fecha mês");
    expect(campos.estiloVisual).toBe("product_hero");
  });

  it("nunca inventa um campo vazio — string em branco vira undefined", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", input: { visual_prompt: "cena de produto", headline: "  ", cta: "" } }],
    });
    const campos = await extrairCamposDePeca("algo simples");
    expect(campos.headline).toBeUndefined();
    expect(campos.cta).toBeUndefined();
  });

  it("estilo_visual fora do vocabulário conhecido nunca é aceito — cai pro default do montador (undefined)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", input: { visual_prompt: "cena", estilo_visual: "cyberpunk-neon-inventado" } }],
    });
    const campos = await extrairCamposDePeca("algo");
    expect(campos.estiloVisual).toBeUndefined();
  });

  it("fail-closed honesto: se a chamada falhar, o pedido inteiro vira visual_prompt (nunca quebra a geração)", async () => {
    mockCreate.mockRejectedValue(new Error("Claude fora do ar"));
    const campos = await extrairCamposDePeca("Anúncio fecha mês da Dog King");
    expect(campos.visualPrompt).toBe("Anúncio fecha mês da Dog King");
    expect(campos.headline).toBeUndefined();
  });

  it("sem bloco tool_use na resposta, também cai pro fallback honesto", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "não sei" }] });
    const campos = await extrairCamposDePeca("pedido qualquer");
    expect(campos.visualPrompt).toBe("pedido qualquer");
  });
});
