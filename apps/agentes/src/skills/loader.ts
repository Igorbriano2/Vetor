// Loader — carregamento progressivo (princípio 8): lista todos os
// manifest.json (pequenos, cabem juntos numa sessão) sem tocar em nenhum
// SKILL.md. O corpo completo de uma skill (instructions + referências) só é
// lido quando registry.ts decide que a intenção do cliente bateu com ela.
//
// Convenção de diretório, uma pasta por skill em ./skills/{id}/:
//   manifest.json   -> SkillManifest (sem source.commit/importedAt fixos
//                       aqui; esses vêm de source-manifest.json, única fonte
//                       de proveniência pra não duplicar/divergir)
//   SKILL.md        -> instructions (texto livre, carregado sob demanda)
//   references/*     -> arquivos de apoio (scripts, exemplos, rubricas),
//                       nunca lidos automaticamente — a skill referencia o
//                       path e quem executa decide se precisa abrir

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillDefinition, SkillManifest, SkillSource } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR_PADRAO = join(__dirname, "skills");

interface ManifestSemSource extends Omit<SkillManifest, "source"> {}

// source-manifest.json sempre vive um nível acima do diretório de skills
// (skills/source-manifest.json, skills/skills/{id}/) — parametrizável só pra
// permitir apontar pra uma fixture isolada em teste, sem mexer no disco real.
function lerSourceManifest(skillsDir: string): Record<string, SkillSource> {
  const path = join(dirname(skillsDir), "source-manifest.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, SkillSource>;
}

// Lista todos os manifestos disponíveis — chamada uma vez por sessão do
// Vetor, resultado pequeno o bastante pra caber inteiro no prompt de seleção
// de skill (nunca o SKILL.md inteiro de cada uma).
export function listarManifestos(skillsDir: string = SKILLS_DIR_PADRAO): SkillManifest[] {
  if (!existsSync(skillsDir)) return [];
  const sources = lerSourceManifest(skillsDir);

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => {
      const manifestPath = join(skillsDir, entrada.name, "manifest.json");
      if (!existsSync(manifestPath)) return null;
      const bruto = JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestSemSource;
      const source = sources[entrada.name];
      if (!source) {
        console.warn(`Skill "${entrada.name}" sem entrada em source-manifest.json — ignorada até ter proveniência registrada.`);
        return null;
      }
      return { ...bruto, source } as SkillManifest;
    })
    .filter((m): m is SkillManifest => m !== null);
}

// Carrega o corpo completo (SKILL.md + lista de referências) — só chamado
// depois que registry.ts decidiu, pelo manifesto, que esta skill é relevante
// pra intenção atual.
export function carregarSkillCompleta(skillId: string, skillsDir: string = SKILLS_DIR_PADRAO): SkillDefinition | null {
  const manifestos = listarManifestos(skillsDir);
  const manifest = manifestos.find((m) => m.id === skillId);
  if (!manifest) return null;

  const dir = join(skillsDir, skillId);
  const skillMdPath = join(dir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    console.warn(`Skill "${skillId}" tem manifest.json mas nenhum SKILL.md — tratada como indisponível.`);
    return null;
  }

  const referencesDir = join(dir, "references");
  const referencePaths = existsSync(referencesDir)
    ? readdirSync(referencesDir).map((arquivo) => join(referencesDir, arquivo))
    : [];

  return {
    manifest,
    instructions: readFileSync(skillMdPath, "utf-8"),
    referencePaths,
  };
}
