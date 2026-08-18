import { describe, expect, it, vi, beforeEach } from "vitest";
import { listarTodosOsManifestos, manifestosPorDepartamento, selecionarSkills, invalidarCache } from "./registry.js";

// Smoke test contra o conteúdo REAL de skills/skills/ (não fixture) — garante
// que toda skill importada de fato passa na validação de permissões
// (permissions.ts) e fica descobrível, sem depender de mock.
describe("skills reais em disco", () => {
  beforeEach(() => invalidarCache());

  it("descobre as 9 skills de Estratégia sem nenhuma reprovada em permissions.ts", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manifestos = manifestosPorDepartamento("strategy");
    const idsEsperados = [
      "product-marketing-context",
      "marketing-diagnosis",
      "marketing-plan",
      "content-strategy",
      "customer-research",
      "offers",
      "marketing-psychology",
      "ab-testing",
      "marketing-loops",
    ];

    expect(manifestos.map((m) => m.id).sort()).toEqual([...idsEsperados].sort());
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("toda skill de estratégia declara proveniência (repo interno ou externo com licença)", () => {
    for (const m of manifestosPorDepartamento("strategy")) {
      expect(m.source.license).toBeTruthy();
      expect(m.source.repository).toBeTruthy();
    }
  });

  it("seleciona product-marketing-context pra um texto de etapa sobre ICP", () => {
    const selecionadas = selecionarSkills("strategy", "preciso entender melhor quem é meu cliente ideal");
    expect(selecionadas[0]?.id).toBe("product-marketing-context");
  });

  it("nenhuma skill de estratégia usa ferramenta de risco acima de low (departamento não deveria precisar de aprovação)", () => {
    for (const m of manifestosPorDepartamento("strategy")) {
      expect(m.riskLevel).toBe("low");
      expect(m.requiresApproval).toBe(false);
    }
  });

  it("listarTodosOsManifestos inclui as skills de estratégia entre os manifestos globais", () => {
    const todos = listarTodosOsManifestos();
    expect(todos.length).toBeGreaterThanOrEqual(9);
  });
});

describe("skills reais em disco — Social Media", () => {
  beforeEach(() => invalidarCache());

  it("descobre as 5 skills de Social Media sem nenhuma reprovada em permissions.ts", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manifestos = manifestosPorDepartamento("social");
    const idsEsperados = [
      "brand-onboarding",
      "content-calendar",
      "caption-writer",
      "social-creative-brief",
      "social-performance-review",
    ];

    expect(manifestos.map((m) => m.id).sort()).toEqual([...idsEsperados].sort());
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("toda skill de social declara proveniência (repo interno ou externo com licença)", () => {
    for (const m of manifestosPorDepartamento("social")) {
      expect(m.source.license).toBeTruthy();
      expect(m.source.repository).toBeTruthy();
    }
  });

  it("seleciona content-calendar pra um texto de etapa sobre calendário editorial", () => {
    const selecionadas = selecionarSkills("social", "preciso montar o calendário editorial do mês");
    expect(selecionadas[0]?.id).toBe("content-calendar");
  });

  it("nenhuma skill de social usa ferramenta de risco acima de low (nunca publica sozinha)", () => {
    for (const m of manifestosPorDepartamento("social")) {
      expect(m.riskLevel).toBe("low");
      expect(m.requiresApproval).toBe(false);
      expect(m.allowedTools).not.toContain("publicar_conteudo_social");
    }
  });
});

describe("skills reais em disco — Design", () => {
  beforeEach(() => invalidarCache());

  it("descobre as 5 skills de Design sem nenhuma reprovada em permissions.ts", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manifestos = manifestosPorDepartamento("design");
    const idsEsperados = ["image-direction", "ad-creative", "social-pack", "brand-compliance", "format-adaptation"];

    expect(manifestos.map((m) => m.id).sort()).toEqual([...idsEsperados].sort());
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("toda skill de design declara proveniência (repo interno ou externo com licença)", () => {
    for (const m of manifestosPorDepartamento("design")) {
      expect(m.source.license).toBeTruthy();
      expect(m.source.repository).toBeTruthy();
    }
  });

  it("skills que chamam gerar_imagem declaram risco medium + requiresApproval (nunca subdeclarado)", () => {
    for (const m of manifestosPorDepartamento("design")) {
      if (m.allowedTools.includes("gerar_imagem")) {
        expect(m.riskLevel).toBe("medium");
        expect(m.requiresApproval).toBe(true);
      }
    }
  });

  it("brand-compliance nunca gera imagem sozinha (é um gate, não uma etapa de geração)", () => {
    const manifestos = manifestosPorDepartamento("design");
    const brandCompliance = manifestos.find((m) => m.id === "brand-compliance");
    expect(brandCompliance?.allowedTools).not.toContain("gerar_imagem");
    expect(brandCompliance?.riskLevel).toBe("low");
  });

  it("seleciona image-direction pra um texto de etapa sobre gerar a arte final", () => {
    const selecionadas = selecionarSkills("design", "preciso gerar imagem pro post de hoje, fazer a imagem final");
    expect(selecionadas[0]?.id).toBe("image-direction");
  });
});

describe("skills reais em disco — Vídeo", () => {
  beforeEach(() => invalidarCache());

  it("descobre as 6 skills de Vídeo sem nenhuma reprovada em permissions.ts", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manifestos = manifestosPorDepartamento("video");
    const idsEsperados = [
      "media-ingestion",
      "transcript-and-highlights",
      "short-form-repurpose",
      "captions-and-format",
      "quality-gate",
      "video-receipt",
    ];

    expect(manifestos.map((m) => m.id).sort()).toEqual([...idsEsperados].sort());
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("toda skill de vídeo declara proveniência (repo interno ou externo com licença)", () => {
    for (const m of manifestosPorDepartamento("video")) {
      expect(m.source.license).toBeTruthy();
      expect(m.source.repository).toBeTruthy();
    }
  });

  it("só short-form-repurpose usa gerar_video_higgsfield, e declara risco medium + requiresApproval", () => {
    for (const m of manifestosPorDepartamento("video")) {
      if (m.allowedTools.includes("gerar_video_higgsfield")) {
        expect(m.id).toBe("short-form-repurpose");
        expect(m.riskLevel).toBe("medium");
        expect(m.requiresApproval).toBe(true);
      } else {
        expect(m.riskLevel).toBe("low");
        expect(m.requiresApproval).toBe(false);
      }
    }
  });

  it("seleciona transcript-and-highlights pra um texto de etapa sobre cortar os melhores momentos", () => {
    const selecionadas = selecionarSkills("video", "corta os melhores momentos da gravação enviada pelo cliente");
    expect(selecionadas[0]?.id).toBe("transcript-and-highlights");
  });
});

describe("skills reais em disco — Tráfego/Analytics", () => {
  beforeEach(() => invalidarCache());

  it("descobre as 6 skills de Tráfego sem nenhuma reprovada em permissions.ts", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manifestos = manifestosPorDepartamento("traffic");
    const idsEsperados = [
      "account-audit-read-only",
      "campaign-analysis",
      "cross-platform-report",
      "attribution-check",
      "budget-recommendation",
      "experiment-analysis",
    ];

    expect(manifestos.map((m) => m.id).sort()).toEqual([...idsEsperados].sort());
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("toda skill de tráfego declara proveniência (repo interno ou externo com licença)", () => {
    for (const m of manifestosPorDepartamento("traffic")) {
      expect(m.source.license).toBeTruthy();
      expect(m.source.repository).toBeTruthy();
    }
  });

  it("nenhuma skill de tráfego usa ferramenta crítica (nunca cria/ajusta campanha sozinha)", () => {
    const FERRAMENTAS_CRITICAS = ["ajustar_orcamento_trafego", "criar_campanha_trafego", "criar_audiencia"];
    for (const m of manifestosPorDepartamento("traffic")) {
      expect(m.riskLevel).toBe("low");
      expect(m.requiresApproval).toBe(false);
      for (const critica of FERRAMENTAS_CRITICAS) {
        expect(m.allowedTools).not.toContain(critica);
      }
    }
  });

  it("seleciona account-audit-read-only pra um texto de etapa sobre auditar a conta de anúncios", () => {
    const selecionadas = selecionarSkills("traffic", "audita minha conta de anúncios antes de propor mudança");
    expect(selecionadas[0]?.id).toBe("account-audit-read-only");
  });
});
