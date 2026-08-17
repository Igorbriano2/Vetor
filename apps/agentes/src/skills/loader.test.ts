import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listarManifestos, carregarSkillCompleta } from "./loader.js";
import type { SkillManifest } from "./types.js";

function manifestBase(overrides: Partial<Omit<SkillManifest, "source">> = {}): Omit<SkillManifest, "source"> {
  return {
    id: "skill-teste",
    version: "1.0.0",
    name: "Skill de teste",
    description: "Usada só nos testes do loader.",
    department: "strategy",
    triggers: ["diagnóstico"],
    requiredContext: [],
    allowedTools: [],
    riskLevel: "low",
    requiresApproval: false,
    outputType: "recommendation",
    ...overrides,
  };
}

describe("skills/loader", () => {
  let raiz: string;
  let skillsDir: string;

  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "vetor-skills-"));
    skillsDir = join(raiz, "skills");
    mkdirSync(skillsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  function criarSkillFixture(id: string, manifest: Partial<Omit<SkillManifest, "source">> = {}, comSkillMd = true) {
    const dir = join(skillsDir, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifestBase({ id, ...manifest })));
    if (comSkillMd) writeFileSync(join(dir, "SKILL.md"), `# ${id}\n\nInstruções da skill.`);
    return dir;
  }

  function escreverSourceManifest(entradas: Record<string, unknown>) {
    writeFileSync(join(raiz, "source-manifest.json"), JSON.stringify(entradas));
  }

  it("retorna lista vazia quando o diretório de skills não existe", () => {
    expect(listarManifestos(join(raiz, "nao-existe"))).toEqual([]);
  });

  it("ignora uma skill sem entrada em source-manifest.json (proveniência obrigatória)", () => {
    criarSkillFixture("sem-fonte");
    escreverSourceManifest({});
    expect(listarManifestos(skillsDir)).toEqual([]);
  });

  it("lista o manifesto com source anexado quando a proveniência existe", () => {
    criarSkillFixture("com-fonte");
    escreverSourceManifest({
      "com-fonte": { repository: "org/repo", commit: "abc123", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
    });

    const manifestos = listarManifestos(skillsDir);
    expect(manifestos).toHaveLength(1);
    expect(manifestos[0].id).toBe("com-fonte");
    expect(manifestos[0].source).toEqual({ repository: "org/repo", commit: "abc123", license: "MIT", importedAt: "2026-08-17T00:00:00Z" });
  });

  it("carregarSkillCompleta devolve null se não houver SKILL.md, mesmo com manifest válido", () => {
    criarSkillFixture("sem-skill-md", {}, false);
    escreverSourceManifest({
      "sem-skill-md": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
    });

    expect(carregarSkillCompleta("sem-skill-md", skillsDir)).toBeNull();
  });

  it("carregarSkillCompleta lê SKILL.md e lista referências só quando a skill foi selecionada", () => {
    const dir = criarSkillFixture("completa");
    mkdirSync(join(dir, "references"), { recursive: true });
    writeFileSync(join(dir, "references", "exemplo.md"), "exemplo");
    escreverSourceManifest({
      completa: { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
    });

    const skill = carregarSkillCompleta("completa", skillsDir);
    expect(skill).not.toBeNull();
    expect(skill!.instructions).toContain("Instruções da skill");
    expect(skill!.referencePaths).toHaveLength(1);
  });
});
