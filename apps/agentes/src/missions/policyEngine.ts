// Policy Engine mínimo — versão v1, escopo deliberadamente reduzido.
//
// O que ESTE módulo cobre: classificação estática de risco por ferramenta e a
// regra de negócio que já existia em prosa em prompts/trafego.md ("NUNCA
// aumentar orçamento de campanha sem aprovação humana nos primeiros 90 dias"),
// agora aplicada no servidor em vez de depender só da instrução ao modelo.
//
// O que fica para depois (docs/manus-jarvis-spec/docs/04-agentes-e-prompts.md,
// agente Governança): políticas configuráveis por cliente, limite de orçamento
// por período, gestão de consentimento. O critério de passagem da Fase 2 do
// roadmap exige que a missão passe por "aprovação com auditoria" — por isso
// esta versão mínima entra nesta rodada, não fica só documentada.

export type Risco = "low" | "medium" | "high";

// Desconhecido = "high": falha fechado, nunca aberto.
const RISCO_POR_FERRAMENTA: Record<string, Risco> = {
  ajustar_orcamento_trafego: "high",
  pausar_campanha_trafego: "medium",
  publicar_conteudo_social: "medium",
  agendar_conteudo_social: "low",
  gerar_copy: "low",
  gerar_design: "low",
  gerar_relatorio: "low",
  transferir_humano: "low",
  registrar_ticket: "low",
};

export function avaliarRisco(ferramentas: string[]): Risco {
  if (ferramentas.length === 0) return "low";

  const ordem: Risco[] = ["low", "medium", "high"];
  let maior: Risco = "low";

  for (const ferramenta of ferramentas) {
    const risco = RISCO_POR_FERRAMENTA[ferramenta] ?? "high";
    if (ordem.indexOf(risco) > ordem.indexOf(maior)) {
      maior = risco;
    }
  }

  return maior;
}

export function precisaAprovacao(risco: Risco): boolean {
  return risco === "medium" || risco === "high";
}

// Regra hardcoded de docs/agentes/prompts/trafego.md: aumento de orçamento de
// tráfego nunca é auto-executado, independente da classificação de risco acima.
export function bloqueiaExecucaoAutomatica(ferramenta: string): boolean {
  return ferramenta === "ajustar_orcamento_trafego";
}
