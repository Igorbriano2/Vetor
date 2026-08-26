import { describe, expect, it } from "vitest";
import { validarPermissoesDaSkill, ferramentasPermitidasParaPapel } from "./permissions.js";
import type { SkillManifest } from "./types.js";

function manifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id: "skill-teste",
    version: "1.0.0",
    name: "Skill de teste",
    description: "teste",
    department: "strategy",
    triggers: [],
    requiredContext: [],
    allowedTools: ["criar_briefing"],
    riskLevel: "low",
    requiresApproval: false,
    outputType: "recommendation",
    source: { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
    ...overrides,
  };
}

describe("validarPermissoesDaSkill", () => {
  it("aprova uma skill com só ferramentas reais do Tool Registry e risco condizente", () => {
    const resultado = validarPermissoesDaSkill(manifest({ allowedTools: ["criar_briefing", "criar_copy"] }));
    expect(resultado.valido).toBe(true);
    expect(resultado.motivos).toEqual([]);
  });

  it("reprova uma skill que declara uma ferramenta fora do Tool Registry (fail-closed)", () => {
    const resultado = validarPermissoesDaSkill(manifest({ allowedTools: ["ferramenta_que_nao_existe"] }));
    expect(resultado.valido).toBe(false);
    expect(resultado.motivos[0]).toMatch(/não existe no Tool Registry/);
  });

  it("reprova uma skill que subdeclara risco em relação à ferramenta que usa", () => {
    // gerar_imagem é "medium" no Tool Registry real
    const resultado = validarPermissoesDaSkill(
      manifest({ allowedTools: ["gerar_imagem"], riskLevel: "low", requiresApproval: false }),
    );
    expect(resultado.valido).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("riskLevel"))).toBe(true);
    expect(resultado.motivos.some((m) => m.includes("requiresApproval"))).toBe(true);
  });

  it("aprova quando riskLevel/requiresApproval batem com o risco real da ferramenta", () => {
    const resultado = validarPermissoesDaSkill(
      manifest({ allowedTools: ["gerar_imagem"], riskLevel: "medium", requiresApproval: true }),
    );
    expect(resultado.valido).toBe(true);
  });

  it("reprova uma ferramenta crítica (ex: excluir_recurso) sem approval no manifesto", () => {
    const resultado = validarPermissoesDaSkill(
      manifest({ allowedTools: ["excluir_recurso"], riskLevel: "critical", requiresApproval: false }),
    );
    expect(resultado.valido).toBe(false);
  });

  it("aprova sem custoEstimado/timeoutMs/idempotencyKey (campos opcionais, skills antigas não têm)", () => {
    const resultado = validarPermissoesDaSkill(manifest());
    expect(resultado.valido).toBe(true);
  });

  it("aprova com custoEstimado/timeoutMs/idempotencyKey válidos", () => {
    const resultado = validarPermissoesDaSkill(
      manifest({ custoEstimado: "medio", timeoutMs: 30000, idempotencyKey: "{missionStepId}:teste" }),
    );
    expect(resultado.valido).toBe(true);
  });

  it("reprova custoEstimado fora do enum (fail-closed)", () => {
    const resultado = validarPermissoesDaSkill(manifest({ custoEstimado: "gigante" as never }));
    expect(resultado.valido).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("custoEstimado"))).toBe(true);
  });

  it("reprova timeoutMs não-positivo", () => {
    const resultado = validarPermissoesDaSkill(manifest({ timeoutMs: 0 }));
    expect(resultado.valido).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("timeoutMs"))).toBe(true);
  });

  it("reprova idempotencyKey vazio (deveria omitir o campo, não declarar string vazia)", () => {
    const resultado = validarPermissoesDaSkill(manifest({ idempotencyKey: "   " }));
    expect(resultado.valido).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("idempotencyKey"))).toBe(true);
  });
});

describe("ferramentasPermitidasParaPapel", () => {
  it("devolve só as ferramentas que o papel tem permissão de chamar", () => {
    const m = manifest({ allowedTools: ["criar_briefing", "criar_copy"] });
    expect(ferramentasPermitidasParaPapel(m, "cliente")).toEqual(["criar_briefing", "criar_copy"]);
  });

  it("devolve lista vazia pra um papel sem nenhuma permissão nas ferramentas da skill", () => {
    const m = manifest({ allowedTools: ["criar_briefing"] });
    expect(ferramentasPermitidasParaPapel(m, "papel-inexistente")).toEqual([]);
  });
});
