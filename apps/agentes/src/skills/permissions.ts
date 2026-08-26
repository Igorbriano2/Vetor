// Permissões de skill — princípio inegociável 3: nenhuma skill pode chamar
// uma ferramenta fora do Tool Registry do VETOR. Isso é validado em dois
// momentos: no registro (uma skill com allowedTools inválido nunca fica
// disponível pro Vetor selecionar) e em runtime (mesmo que o manifesto
// estivesse certo no registro, a chamada real ainda passa pelo Policy Engine
// normal — este módulo não substitui policyEngine.ts/tools/registry.ts,
// só garante que uma skill nunca declara mais do que o gateway permite).

import { TOOL_REGISTRY } from "../tools/registry.js";
import type { SkillCustoEstimado, SkillManifest } from "./types.js";

export interface ValidacaoPermissaoSkill {
  valido: boolean;
  motivos: string[];
}

const CUSTOS_VALIDOS: SkillCustoEstimado[] = ["nenhum", "baixo", "medio", "alto"];

// custoEstimado/timeoutMs/idempotencyKey são opcionais (skills antigas não
// os têm), mas fail-closed quando presentes — mesmo padrão do resto deste
// arquivo, nunca aceitar um valor fora do esperado silenciosamente.
function validarCamposOpcionais(manifest: SkillManifest): string[] {
  const motivos: string[] = [];

  if (manifest.custoEstimado !== undefined && !CUSTOS_VALIDOS.includes(manifest.custoEstimado)) {
    motivos.push(`custoEstimado "${manifest.custoEstimado}" inválido — precisa ser um de: ${CUSTOS_VALIDOS.join(", ")}.`);
  }

  if (manifest.timeoutMs !== undefined && (!Number.isFinite(manifest.timeoutMs) || manifest.timeoutMs <= 0)) {
    motivos.push(`timeoutMs "${manifest.timeoutMs}" inválido — precisa ser um número positivo.`);
  }

  if (manifest.idempotencyKey !== undefined && manifest.idempotencyKey.trim() === "") {
    motivos.push("idempotencyKey declarado mas vazio — omita o campo em vez de declarar string vazia.");
  }

  return motivos;
}

// Toda ferramenta declarada em allowedTools precisa existir no Tool
// Registry — fail-closed: uma skill com ferramenta desconhecida nunca é
// registrada (ver registry.ts:registrarSkill), nunca cai no fallback
// "crítico" silencioso que já causou um bug real no Vetor antes desta rodada
// (ver vetorPlataforma.ts, NOMES_FERRAMENTAS_VALIDOS).
export function validarPermissoesDaSkill(manifest: SkillManifest): ValidacaoPermissaoSkill {
  const motivos: string[] = [];

  for (const nome of manifest.allowedTools) {
    if (!(nome in TOOL_REGISTRY)) {
      motivos.push(`Ferramenta "${nome}" declarada em allowedTools não existe no Tool Registry.`);
    }
  }

  // O riskLevel/requiresApproval do manifesto precisa ser consistente com o
  // risco real das ferramentas que a skill usa — nunca subdeclarar risco pra
  // fugir de aprovação (ex: skill que usa uma tool "critical" mas se declara
  // "low" e requiresApproval:false).
  const ordem = ["low", "medium", "high", "critical"];
  const maiorRiscoReal = manifest.allowedTools.reduce((maior, nome) => {
    const risco = TOOL_REGISTRY[nome]?.riskLevel;
    if (!risco) return maior;
    return ordem.indexOf(risco) > ordem.indexOf(maior) ? risco : maior;
  }, "low");

  if (ordem.indexOf(maiorRiscoReal) > ordem.indexOf(manifest.riskLevel)) {
    motivos.push(
      `riskLevel do manifesto ("${manifest.riskLevel}") é menor que o risco real das ferramentas usadas ("${maiorRiscoReal}").`,
    );
  }
  if (maiorRiscoReal !== "low" && !manifest.requiresApproval) {
    motivos.push(`Skill usa ferramenta de risco "${maiorRiscoReal}" mas requiresApproval está false.`);
  }

  motivos.push(...validarCamposOpcionais(manifest));

  return { valido: motivos.length === 0, motivos };
}

// Interseção entre o que a skill declara e o que o papel do ator realmente
// pode chamar (allowedRoles de cada ferramenta no Tool Registry) — usado
// pelo especialista antes de montar o SkillContext.ferramentasPermitidas.
export function ferramentasPermitidasParaPapel(manifest: SkillManifest, papel: string): string[] {
  return manifest.allowedTools.filter((nome) => TOOL_REGISTRY[nome]?.allowedRoles.includes(papel));
}
