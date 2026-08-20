// Fase 4 do reset de produto (docs/PRODUCT-RESET-AUDIT.md), estendido na
// Fase 2 do Vetor Manager (docs/VETOR-PRODUCT-CONTRACT.md) — traduz o status
// técnico de uma etapa/peça pro vocabulário amigável pedido pelos dois
// prompts mestres. Cada rótulo aqui só é usado quando existe um sinal REAL
// por trás (nunca inventado):
//   - mission_steps.status (Policy Engine, já existente)
//   - design_projects.status/version (draft/approved, versionamento real)
//   - missions.status (terminal ou não)
//   - mission_steps.resultado.imagemIndisponivel (ProviderRouter esgotado,
//     ver AgentResult em specialistRunner.ts)
// "Escolha uma direção" (o cliente escolhe entre N opções geradas) exige um
// conceito real de "peça com N direções irmãs" que ainda não existe como
// dado persistido (mission_steps não guarda a chave do plano) — fica como
// limitação conhecida, documentada, em vez de um heurística frágil de
// parsing de texto.

export type StatusDePeca =
  | "Briefing recebido"
  | "Aguardando sua aprovação"
  | "Criando opções"
  | "Em edição"
  | "Pronta para aprovação"
  | "Aprovada"
  | "Entregue"
  | "Provedor de imagem indisponível — briefing pronto";

export const GRUPO_STATUS_PECA: Record<StatusDePeca, "info" | "decisao" | "sucesso" | "atencao"> = {
  "Briefing recebido": "info",
  "Aguardando sua aprovação": "decisao",
  "Criando opções": "info",
  "Em edição": "decisao",
  "Pronta para aprovação": "decisao",
  Aprovada: "sucesso",
  Entregue: "sucesso",
  "Provedor de imagem indisponível — briefing pronto": "atencao",
};

// Retorna null pra status que este vocabulário não cobre honestamente
// (failed/blocked/cancelled/skipped) — o chamador cai pro StatusBadge
// técnico normal nesses casos, nunca força um rótulo amigável errado
// (ex: nunca mostrar "Briefing recebido" pra uma etapa que falhou).
export function traduzirStatusDePeca(input: {
  stepStatus: string;
  missaoStatus: string;
  designProjectStatus?: "draft" | "awaiting_approval" | "approved" | "archived" | null;
  designProjectVersion?: number | null;
  // Sinal estruturado real vindo de mission_steps.resultado.imagemIndisponivel
  // (ver AgentResult em specialistRunner.ts) — nunca inferido de texto.
  imagemIndisponivel?: boolean;
}): StatusDePeca | null {
  const { stepStatus, missaoStatus, designProjectStatus, designProjectVersion, imagemIndisponivel } = input;

  if (designProjectStatus === "approved") {
    const missaoTerminal = ["completed", "completed_with_caveats"].includes(missaoStatus);
    return missaoTerminal ? "Entregue" : "Aprovada";
  }

  // Inspirado na transparência de fallback de provedor da Gravyx (ver
  // docs/VETOR-PRODUCT-CONTRACT.md) — quando o ProviderRouter esgota todos
  // os provedores de imagem, o cliente vê uma explicação honesta em vez de
  // "Algo precisa ser revisado" cru ou silêncio sem contexto.
  if (stepStatus === "failed" && imagemIndisponivel) return "Provedor de imagem indisponível — briefing pronto";

  if (stepStatus === "pending" || stepStatus === "ready") return "Briefing recebido";
  if (stepStatus === "awaiting_approval") return "Aguardando sua aprovação";
  if (stepStatus === "running") return "Criando opções";

  if (stepStatus === "completed" || stepStatus === "completed_with_caveats") {
    // version > 1 prova que existe uma versão salva depois da original
    // gerada pela IA — sinal real de que o cliente editou pelo menos uma
    // vez (nunca um "está editando agora" literal, que exigiria presença
    // em tempo real).
    if (designProjectStatus === "draft" && (designProjectVersion ?? 1) > 1) return "Em edição";
    return "Pronta para aprovação";
  }

  return null;
}
