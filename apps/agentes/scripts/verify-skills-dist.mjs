// Verificação pós-build: confirma que dist/skills está exatamente onde o
// código bundlado espera encontrar (SKILLS_DIR_PADRAO em skills/loader.ts =
// dirname(worker.js) + "/skills"). Achado em produção: o esbuild --bundle
// muda o que __dirname resolve dentro do runtime (deixa de ser a pasta
// original de loader.ts e passa a ser a pasta do bundle), então um mismatch
// de nível de diretório entre o script de build e esse cálculo fica
// completamente silencioso — nenhum erro, nenhum warning, só "manifestos
// disponíveis: (nenhum)" em produção. Falha o build (exit 1) se a estrutura
// não bater, em vez de deixar isso ser descoberto só ao vivo de novo.

import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const skillsDir = join(distDir, "skills");
const sourceManifestPath = join(distDir, "source-manifest.json");

const erros = [];

if (!existsSync(skillsDir)) {
  erros.push(`dist/skills não existe (esperado em ${skillsDir})`);
} else {
  const pastas = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (pastas.length === 0) {
    erros.push("dist/skills existe mas não tem nenhuma pasta de skill dentro (esperado dist/skills/{id}/manifest.json)");
  }
  for (const pasta of pastas) {
    const manifestPath = join(skillsDir, pasta.name, "manifest.json");
    const skillMdPath = join(skillsDir, pasta.name, "SKILL.md");
    if (!existsSync(manifestPath)) erros.push(`dist/skills/${pasta.name}/manifest.json ausente`);
    if (!existsSync(skillMdPath)) erros.push(`dist/skills/${pasta.name}/SKILL.md ausente`);
  }
}

if (!existsSync(sourceManifestPath)) {
  erros.push(`dist/source-manifest.json não existe (esperado em ${sourceManifestPath}, NÃO dentro de dist/skills/)`);
}

if (erros.length > 0) {
  console.error("verify-skills-dist: layout de dist/ incompatível com o path resolvido em runtime pelo bundle:");
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log("verify-skills-dist: ok — dist/skills e dist/source-manifest.json no lugar esperado pelo runtime bundlado.");
