import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { manifestosPorDepartamento, selecionarSkills, carregarSkillsSelecionadas, invalidarCache } from "./registry.js";
import type { SkillManifest } from "./types.js";

function escreverSkill(skillsDir: string, id: string, manifest: Partial<Omit<SkillManifest, "source" | "id">>) {
  const dir = join(skillsDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({
      id,
      version: "1.0.0",
      name: id,
      description: "teste",
      department: "strategy",
      triggers: [],
      requiredContext: [],
      allowedTools: [],
      riskLevel: "low",
      requiresApproval: false,
      outputType: "recommendation",
      ...manifest,
    }),
  );
  writeFileSync(join(dir, "SKILL.md"), `# ${id}`);
}

describe("skills/registry", () => {
  let raiz: string;
  let skillsDir: string;

  beforeEach(() => {
    invalidarCache();
    raiz = mkdtempSync(join(tmpdir(), "vetor-skills-registry-"));
    skillsDir = join(raiz, "skills");
    mkdirSync(skillsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true });
    invalidarCache();
  });

  it("nunca lista uma skill com ferramenta fora do Tool Registry (fail-closed no registro)", () => {
    escreverSkill(skillsDir, "skill-invalida", { allowedTools: ["ferramenta_inexistente"] });
    writeFileSync(
      join(raiz, "source-manifest.json"),
      JSON.stringify({ "skill-invalida": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" } }),
    );

    expect(manifestosPorDepartamento("strategy", skillsDir)).toEqual([]);
  });

  it("filtra manifestos por departamento — departamentos diferentes nunca se veem", () => {
    escreverSkill(skillsDir, "skill-estrategia", { department: "strategy", triggers: ["diagnóstico"] });
    escreverSkill(skillsDir, "skill-design", { department: "design", triggers: ["arte"] });
    writeFileSync(
      join(raiz, "source-manifest.json"),
      JSON.stringify({
        "skill-estrategia": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
        "skill-design": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
      }),
    );

    const estrategia = manifestosPorDepartamento("strategy", skillsDir);
    expect(estrategia.map((m) => m.id)).toEqual(["skill-estrategia"]);
  });

  it("seleciona skill por trigger e ordena pela mais específica (mais triggers batidos primeiro)", () => {
    escreverSkill(skillsDir, "skill-generica", { department: "strategy", triggers: ["diagnóstico"] });
    escreverSkill(skillsDir, "skill-especifica", { department: "strategy", triggers: ["diagnóstico", "posicionamento"] });
    writeFileSync(
      join(raiz, "source-manifest.json"),
      JSON.stringify({
        "skill-generica": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
        "skill-especifica": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
      }),
    );

    const selecionadas = selecionarSkills("strategy", "preciso de um diagnóstico de posicionamento pro cliente", skillsDir);
    expect(selecionadas.map((m) => m.id)).toEqual(["skill-especifica", "skill-generica"]);
  });

  it("não seleciona nenhuma skill quando o texto não bate com nenhum trigger", () => {
    escreverSkill(skillsDir, "skill-estrategia", { department: "strategy", triggers: ["diagnóstico"] });
    writeFileSync(
      join(raiz, "source-manifest.json"),
      JSON.stringify({ "skill-estrategia": { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" } }),
    );

    expect(selecionarSkills("strategy", "quero um post pro instagram", skillsDir)).toEqual([]);
  });

  it("carregarSkillsSelecionadas só lê o corpo completo das skills passadas, ignora as demais", () => {
    escreverSkill(skillsDir, "a", { department: "strategy" });
    escreverSkill(skillsDir, "b", { department: "strategy" });
    writeFileSync(
      join(raiz, "source-manifest.json"),
      JSON.stringify({
        a: { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
        b: { repository: "org/repo", commit: "abc", license: "MIT", importedAt: "2026-08-17T00:00:00Z" },
      }),
    );

    const carregadas = carregarSkillsSelecionadas(["a"], skillsDir);
    expect(carregadas.map((s) => s.manifest.id)).toEqual(["a"]);
  });
});
