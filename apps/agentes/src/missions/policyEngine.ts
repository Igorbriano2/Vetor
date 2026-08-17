// Policy Engine — v1 estendida na Fase 5/6.
//
// O que ESTE módulo cobre: classificação de risco por ferramenta (agora
// derivada do gateway de ferramentas em tools/registry.ts, fonte única — antes
// desta rodada era uma tabela solta aqui, com uma cópia duplicada no painel)
// e a regra de negócio que já existia em prosa em prompts/trafego.md ("NUNCA
// aumentar orçamento de campanha sem aprovação humana nos primeiros 90 dias"),
// agora generalizada: qualquer ferramenta "critical" bloqueia execução
// automática, não só ajustar_orcamento_trafego especificamente.
//
// O que fica para depois (docs/manus-jarvis-spec/docs/04-agentes-e-prompts.md,
// agente Governança): políticas configuráveis por cliente, limite de orçamento
// por período, gestão de consentimento.

import { buscarFerramenta, type ToolRiskLevel } from "../tools/registry.js";

export type Risco = ToolRiskLevel;

export function avaliarRisco(ferramentas: string[]): Risco {
  if (ferramentas.length === 0) return "low";

  const ordem: Risco[] = ["low", "medium", "high", "critical"];
  let maior: Risco = "low";

  for (const nome of ferramentas) {
    const risco = buscarFerramenta(nome).riskLevel;
    if (ordem.indexOf(risco) > ordem.indexOf(maior)) {
      maior = risco;
    }
  }

  return maior;
}

export function precisaAprovacao(risco: Risco): boolean {
  return risco === "medium" || risco === "high" || risco === "critical";
}

// Qualquer ferramenta "critical" no registro nunca é auto-executada, mesmo
// com aprovação de uma etapa vizinha — ver tools/registry.ts.
export function bloqueiaExecucaoAutomatica(ferramenta: string): boolean {
  return buscarFerramenta(ferramenta).riskLevel === "critical";
}
