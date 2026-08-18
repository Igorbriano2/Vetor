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
