import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  avaliarPecaDeDesign,
  avaliarRiscoDeTextoNoFundo,
  calcularCriteriosEstruturais,
  combinarComCriteriosEstruturais,
  type DesignCriticResultado,
} from "./designCritic.js";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const CHECKLIST_APROVADO = {
  composicaoHierarquia: true,
  contraste: true,
  legibilidadeMobile: true,
  tipografia: true,
  proporcao: true,
  alinhamento: true,
  respiroVisual: true,
  cta: true,
  usoDaLogo: true,
  aderenciaBrandKit: true,
  adequacaoAoCanal: true,
  coerenciaComPedido: true,
};

function respostaAnthropicComToolUse(input: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      id: "msg_teste",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-5",
      content: [{ type: "tool_use", id: "toolu_teste", name: "avaliar_peca", input }],
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("avaliarPecaDeDesign (DesignCritic)", () => {
  const chaveOriginal = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (chaveOriginal === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = chaveOriginal;
  });

  it("reprova (fail-closed) sem inventar aprovação quando a chamada ao modelo falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const resultado = await avaliarPecaDeDesign({
      imagemBytes: png1x1,
      mimeType: "image/png",
      briefOriginal: "arte de teste",
      formato: "feed",
      logoDeveriaEstarAplicada: false,
    });

    expect(resultado.passed).toBe(false);
    expect(resultado.issues.length).toBeGreaterThan(0);
  });

  it("reprova (fail-closed) se a resposta não vier com a ferramenta avaliar_peca", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "msg_teste",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-4-5",
            content: [{ type: "text", text: "não vou usar a ferramenta" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 5, output_tokens: 5 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const resultado = await avaliarPecaDeDesign({
      imagemBytes: png1x1,
      mimeType: "image/png",
      briefOriginal: "arte de teste",
      formato: "feed",
      logoDeveriaEstarAplicada: false,
    });

    expect(resultado.passed).toBe(false);
  });

  it("repassa o veredito estruturado quando o modelo aprova a peça", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaAnthropicComToolUse({
          passed: true,
          resumo: "Peça pronta pra publicação.",
          issues: [],
          checklist: CHECKLIST_APROVADO,
        }),
      ),
    );

    const resultado = await avaliarPecaDeDesign({
      imagemBytes: png1x1,
      mimeType: "image/png",
      briefOriginal: "arte de teste",
      formato: "feed",
      logoDeveriaEstarAplicada: false,
    });

    expect(resultado.passed).toBe(true);
    expect(resultado.issues).toEqual([]);
    expect(resultado.checklist.contraste).toBe(true);
  });

  it("repassa issues concretos quando o modelo reprova a peça", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaAnthropicComToolUse({
          passed: false,
          resumo: "Contraste insuficiente e CTA ausente.",
          issues: ["Texto branco sobre fundo amarelo claro sem contraste suficiente.", "Não há CTA visível na peça."],
          checklist: { ...CHECKLIST_APROVADO, contraste: false, cta: false },
        }),
      ),
    );

    const resultado = await avaliarPecaDeDesign({
      imagemBytes: png1x1,
      mimeType: "image/png",
      briefOriginal: "arte de teste",
      formato: "feed",
      logoDeveriaEstarAplicada: true,
    });

    expect(resultado.passed).toBe(false);
    expect(resultado.issues).toHaveLength(2);
    expect(resultado.checklist.contraste).toBe(false);
  });
});

describe("avaliarRiscoDeTextoNoFundo (fail-closed)", () => {
  const chaveOriginal = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (chaveOriginal === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = chaveOriginal;
  });

  it("assume risco=true (nunca 'sem risco' por omissão) quando a chamada falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(avaliarRiscoDeTextoNoFundo(png1x1, "image/png")).resolves.toBe(true);
  });

  it("repassa false quando o modelo real avalia que não há texto no fundo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "msg_teste",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-4-5",
            content: [{ type: "tool_use", id: "toolu_teste", name: "avaliar_risco_de_texto", input: { contemTextoOuLogoLegivel: false, observacao: "cena limpa" } }],
            stop_reason: "tool_use",
            usage: { input_tokens: 5, output_tokens: 5 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(avaliarRiscoDeTextoNoFundo(png1x1, "image/png")).resolves.toBe(false);
  });
});

describe("calcularCriteriosEstruturais", () => {
  it("aprova quando todo campo obrigatório virou camada e a logo obrigatória está presente", () => {
    const resultado = calcularCriteriosEstruturais({
      camposDeTextoObrigatorios: ["headline", "cta"],
      camposDeTextoPresentes: ["headline", "cta"],
      logoObrigatoria: true,
      logoPresenteComoCamadaIndependente: true,
      areaSeguraValidaParaTodasAsCamadas: true,
      ativosDeMarcaValidos: true,
    });
    expect(resultado).toEqual({ hasEditableTextLayers: true, hasIndependentLogoLayer: true, safeAreaValid: true, brandAssetValid: true });
  });

  it("reprova hasEditableTextLayers quando um campo obrigatório não virou camada", () => {
    const resultado = calcularCriteriosEstruturais({
      camposDeTextoObrigatorios: ["headline", "cta"],
      camposDeTextoPresentes: ["headline"],
      logoObrigatoria: false,
      logoPresenteComoCamadaIndependente: false,
      areaSeguraValidaParaTodasAsCamadas: true,
      ativosDeMarcaValidos: true,
    });
    expect(resultado.hasEditableTextLayers).toBe(false);
  });

  it("hasIndependentLogoLayer é sempre true quando a logo não é obrigatória (nenhuma logo cadastrada)", () => {
    const resultado = calcularCriteriosEstruturais({
      camposDeTextoObrigatorios: [],
      camposDeTextoPresentes: [],
      logoObrigatoria: false,
      logoPresenteComoCamadaIndependente: false,
      areaSeguraValidaParaTodasAsCamadas: true,
      ativosDeMarcaValidos: true,
    });
    expect(resultado.hasIndependentLogoLayer).toBe(true);
  });

  it("reprova hasIndependentLogoLayer quando a logo é obrigatória mas não está presente como camada", () => {
    const resultado = calcularCriteriosEstruturais({
      camposDeTextoObrigatorios: [],
      camposDeTextoPresentes: [],
      logoObrigatoria: true,
      logoPresenteComoCamadaIndependente: false,
      areaSeguraValidaParaTodasAsCamadas: true,
      ativosDeMarcaValidos: true,
    });
    expect(resultado.hasIndependentLogoLayer).toBe(false);
  });
});

describe("combinarComCriteriosEstruturais", () => {
  const resultadoVisualAprovado: DesignCriticResultado = {
    passed: true,
    resumo: "ok",
    issues: [],
    checklist: {
      composicaoHierarquia: true,
      contraste: true,
      legibilidadeMobile: true,
      tipografia: true,
      proporcao: true,
      alinhamento: true,
      respiroVisual: true,
      cta: true,
      usoDaLogo: true,
      aderenciaBrandKit: true,
      adequacaoAoCanal: true,
      coerenciaComPedido: true,
    },
  };

  it("mantém aprovado quando visual passou e todos os critérios estruturais estão ok", () => {
    const combinado = combinarComCriteriosEstruturais(resultadoVisualAprovado, {
      hasEditableTextLayers: true,
      hasIndependentLogoLayer: true,
      backgroundHasEmbeddedTextRisk: false,
      safeAreaValid: true,
      brandAssetValid: true,
    });
    expect(combinado.passed).toBe(true);
    expect(combinado.issues).toEqual([]);
  });

  it("reprova quando o visual passou mas o fundo tem risco de texto cozido (polaridade invertida)", () => {
    const combinado = combinarComCriteriosEstruturais(resultadoVisualAprovado, {
      hasEditableTextLayers: true,
      hasIndependentLogoLayer: true,
      backgroundHasEmbeddedTextRisk: true,
      safeAreaValid: true,
      brandAssetValid: true,
    });
    expect(combinado.passed).toBe(false);
    expect(combinado.issues.some((i) => i.includes("cozido"))).toBe(true);
  });

  it("reprova quando o visual já tinha reprovado, mesmo com todos os critérios estruturais ok", () => {
    const combinado = combinarComCriteriosEstruturais(
      { ...resultadoVisualAprovado, passed: false, issues: ["contraste ruim"] },
      { hasEditableTextLayers: true, hasIndependentLogoLayer: true, backgroundHasEmbeddedTextRisk: false, safeAreaValid: true, brandAssetValid: true },
    );
    expect(combinado.passed).toBe(false);
    expect(combinado.issues).toContain("contraste ruim");
  });

  it("acumula uma mensagem por critério estrutural reprovado, sem descartar as issues visuais originais", () => {
    const combinado = combinarComCriteriosEstruturais(
      { ...resultadoVisualAprovado, issues: ["algo visual"] },
      { hasEditableTextLayers: false, hasIndependentLogoLayer: false, backgroundHasEmbeddedTextRisk: false, safeAreaValid: false, brandAssetValid: true },
    );
    expect(combinado.issues).toHaveLength(4); // 1 visual + 3 estruturais reprovados
    expect(combinado.criteriosEstruturais?.hasEditableTextLayers).toBe(false);
  });
});
