// Skill Registry — tipos base. Uma skill é instrução + workflow versionado
// (SKILL.md + manifest), nunca um substituto de agente/tool/worker/runtime —
// ver docs/skills/README.md para o desenho completo. Estes tipos são
// deliberadamente pequenos: o manifesto é o que carrega pro prompt do
// especialista (carregamento progressivo), o SKILL.md só é lido sob demanda
// quando uma skill é de fato selecionada.

import type { ToolRiskLevel } from "../tools/registry.js";

export type SkillDepartment =
  | "strategy"
  | "growth"
  | "traffic"
  | "social"
  | "design"
  | "video"
  | "analytics"
  | "operations";

export type SkillOutputType =
  | "recommendation"
  | "document"
  | "image"
  | "video"
  | "campaign_proposal"
  | "report"
  | "schedule";

export interface SkillSource {
  repository: string;
  commit: string;
  license: string;
  importedAt: string;
}

// Estimativa categórica, não um valor em centavos: uma skill nunca chama um
// provider diretamente (só orienta o especialista a usar tools do gateway),
// então o custo real de uma execução depende de quais/quantas tools o
// especialista de fato invoca durante a etapa — não é algo que o manifesto
// possa declarar com precisão numérica. "nenhum" é pra skills puramente de
// raciocínio/formatação (nunca chamam tool paga).
export type SkillCustoEstimado = "nenhum" | "baixo" | "medio" | "alto";

// O manifesto é a unidade de carregamento progressivo (princípio 8): cabe
// inteiro num manifesto pequeno por sessão, sem precisar ler o SKILL.md
// completo até a intenção do cliente bater com um trigger.
export interface SkillManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  department: SkillDepartment;
  triggers: string[];
  requiredContext: string[];
  allowedTools: string[];
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  outputType: SkillOutputType;
  source: SkillSource;
  /** Opcional — ausente em skills antigas, sempre validado quando presente (permissions.ts). */
  custoEstimado?: SkillCustoEstimado;
  /** Opcional, em milissegundos. */
  timeoutMs?: number;
  /**
   * Opcional — template de chave pra identificar execuções repetidas da
   * mesma skill pro mesmo contexto (ex: "{missionStepId}:{skillId}"), pra
   * quem orquestra evitar reprocessar. A skill só declara o template; quem
   * gera a chave real é o especialista, usando o SkillContext da execução.
   */
  idempotencyKey?: string;
}

// SkillDefinition = manifesto + corpo carregado sob demanda (loader.ts lê
// isso só quando a skill é selecionada, nunca no manifesto pequeno).
export interface SkillDefinition {
  manifest: SkillManifest;
  instructions: string; // conteúdo de SKILL.md
  referencePaths: string[]; // arquivos de referência/scripts, lidos só se a skill pedir
}

// Contexto mínimo que todo especialista recebe antes de rodar uma skill —
// ver Fase 3 do pedido original: tenantId nunca é opcional, nenhuma skill
// roda sem isolamento de cliente explícito.
export interface SkillContext {
  tenantId: string;
  businessProfileId?: string;
  missionId?: string;
  missionStepId?: string;
  requestId: string;
  objetivo: string;
  brandKit?: Record<string, unknown> | null;
  dadosRelevantes?: Record<string, unknown>;
  ferramentasPermitidas: string[];
  limites?: Record<string, unknown>;
  aprovacaoExistente?: boolean;
}

export type SkillRunStatus = "completed" | "failed" | "needs_approval" | "needs_clarification";

// Registro de execução — auditável, uma linha por skill rodada (persistido
// via skillRunsService, isolado por tenantId como qualquer outra tabela).
export interface SkillRun {
  id: string;
  skillId: string;
  skillVersion: string;
  tenantId: string;
  missionId?: string;
  missionStepId?: string;
  status: SkillRunStatus;
  startedAt: string;
  finishedAt?: string;
  toolsUsed: string[];
  artifactIds: string[];
  summary: string;
  error?: string;
}

export type SkillEvalVerdict = "pass" | "fail" | "warn";

// Um caso de avaliação por skill (Fase 7) — não é teste unitário de código,
// é rubrica de qualidade do output (coerência, artefato real, etc.).
export interface SkillEvaluation {
  skillId: string;
  caseId: string;
  description: string;
  verdict: SkillEvalVerdict;
  reasons: string[];
}
