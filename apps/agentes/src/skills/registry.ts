// Skill Registry — descoberta e carregamento progressivo. O Vetor/especialista
// nunca lê skills/{id}/SKILL.md direto: sempre passa por aqui, que garante
// (a) só skills com permissão válida (permissions.ts) ficam visíveis, e (b)
// o corpo completo de uma skill só é carregado quando ela foi de fato
// selecionada pra intenção atual (princípio 8).

import { listarManifestos, carregarSkillCompleta } from "./loader.js";
import { validarPermissoesDaSkill } from "./permissions.js";
import type { SkillDefinition, SkillDepartment, SkillManifest } from "./types.js";

const cachePorDiretorio = new Map<string, SkillManifest[]>();

// Valida todos os manifestos uma vez por diretório (fail-closed: skill
// inválida nunca fica visível, só loga o motivo) e cacheia — releitura do
// disco só acontece se alguém chamar invalidarCache(). skillsDir é
// parametrizável só pra permitir testes com uma fixture isolada.
function manifestosValidos(skillsDir?: string): SkillManifest[] {
  const chave = skillsDir ?? "__padrao__";
  const cacheado = cachePorDiretorio.get(chave);
  if (cacheado) return cacheado;

  const validos = listarManifestos(skillsDir).filter((manifest) => {
    const validacao = validarPermissoesDaSkill(manifest);
    if (!validacao.valido) {
      console.warn(`Skill "${manifest.id}" reprovada na validação de permissões: ${validacao.motivos.join("; ")}`);
    }
    return validacao.valido;
  });

  cachePorDiretorio.set(chave, validos);
  return validos;
}

export function invalidarCache(): void {
  cachePorDiretorio.clear();
}

// Manifesto pequeno por departamento — é isto que entra no prompt de um
// especialista, nunca o catálogo inteiro (departamentos diferentes nunca se
// veem).
export function manifestosPorDepartamento(department: SkillDepartment, skillsDir?: string): SkillManifest[] {
  return manifestosValidos(skillsDir).filter((m) => m.department === department);
}

// Seleção por trigger — combinação simples e auditável (substring
// case-insensitive contra o texto da etapa/objetivo), não um classificador
// opaco: o Vetor/especialista consegue explicar por que escolheu uma skill.
// Ordena por nº de triggers batidos (mais específico primeiro).
export function selecionarSkills(department: SkillDepartment, textoDaEtapa: string, skillsDir?: string): SkillManifest[] {
  const texto = textoDaEtapa.toLowerCase();
  return manifestosPorDepartamento(department, skillsDir)
    .map((manifest) => ({
      manifest,
      matches: manifest.triggers.filter((t) => texto.includes(t.toLowerCase())).length,
    }))
    .filter((x) => x.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .map((x) => x.manifest);
}

// Carrega o corpo completo só das skills já selecionadas — nunca todas.
export function carregarSkillsSelecionadas(ids: string[], skillsDir?: string): SkillDefinition[] {
  return ids.map((id) => carregarSkillCompleta(id, skillsDir)).filter((s): s is SkillDefinition => s !== null);
}

export function listarTodosOsManifestos(skillsDir?: string): SkillManifest[] {
  return manifestosValidos(skillsDir);
}
