// Gateway de ferramentas (Fase 6) — registro único de risco/permissão por
// ferramenta no backend. Antes desta rodada, risco era classificado só numa
// tabela solta dentro de policyEngine.ts (e replicada, com deriva possível,
// numa cópia local em VetorIntentCard.tsx no painel). Agora policyEngine.ts
// deriva a classificação DESTE registro — uma fonte de verdade só.
//
// Nomes de ferramenta aqui cobrem tanto o vocabulário já usado pelos prompts
// de especialista (gerar_copy, gerar_design, gerar_relatorio...) quanto o
// vocabulário novo pedido para o gateway (criar_briefing, criar_versao...) —
// nada foi renomeado pra não quebrar missões/etapas já gravadas com os nomes
// antigos.

export type ToolRiskLevel = "low" | "medium" | "high" | "critical";

export interface VetorToolDefinition {
  name: string;
  description: string;
  inputSchema: { required?: string[]; properties?: Record<string, unknown> };
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  allowedRoles: string[];
  reversible: boolean;
  estimatedCost?: number;
}

const PAPEIS_PADRAO = ["cliente", "admin_vetor"];

function ferramenta(
  name: string,
  description: string,
  riskLevel: ToolRiskLevel,
  overrides: Partial<VetorToolDefinition> = {},
): VetorToolDefinition {
  return {
    name,
    description,
    inputSchema: { required: [] },
    riskLevel,
    requiresApproval: riskLevel === "medium" || riskLevel === "high" || riskLevel === "critical",
    allowedRoles: PAPEIS_PADRAO,
    reversible: riskLevel === "low" || riskLevel === "medium",
    ...overrides,
  };
}

// Baixo risco — leitura de contexto e criação de artefato/rascunho, sem efeito
// externo. Liberadas pra execução automática (sem aprovação humana).
const FERRAMENTAS_BAIXO_RISCO: VetorToolDefinition[] = [
  ferramenta("ler_perfil_negocio", "Lê o perfil de negócio cadastrado do cliente.", "low"),
  ferramenta("ler_brand_kit", "Lê o brand kit atual (cores, fontes, regras) do cliente.", "low"),
  ferramenta("ler_historico", "Lê histórico de conversas/missões anteriores do cliente.", "low"),
  ferramenta(
    "criar_briefing",
    "Cria um briefing estruturado pra orientar uma peça ou campanha.",
    "low",
    { inputSchema: { required: ["titulo", "objetivo"] } },
  ),
  ferramenta("criar_copy", "Gera texto/copy pra uma peça de conteúdo.", "low", {
    inputSchema: { required: ["objetivo"] },
  }),
  ferramenta("gerar_copy", "Alias legado de criar_copy — mesmo comportamento.", "low"),
  ferramenta("gerar_design", "Gera briefing/peça de design.", "low"),
  ferramenta("criar_relatorio", "Monta um relatório de período a partir de dados já coletados.", "low"),
  ferramenta("gerar_relatorio", "Alias legado de criar_relatorio.", "low"),
  ferramenta("salvar_hipotese", "Registra uma hipótese de negócio na memória operacional.", "low", {
    inputSchema: { required: ["hipotese"] },
  }),
  ferramenta("criar_artefato", "Registra um artefato (peça, documento) gerado por uma etapa.", "low"),
  ferramenta("criar_versao", "Cria uma nova versão de um artefato já existente.", "low"),
  ferramenta("registrar_experimento", "Registra um experimento e seu resultado na memória operacional.", "low"),
  ferramenta("solicitar_aprovacao", "Cria uma solicitação de aprovação explícita pro cliente.", "low", {
    reversible: true,
  }),
  ferramenta("transferir_humano", "Transfere o atendimento pra um humano da agência.", "low"),
  ferramenta("registrar_ticket", "Registra um ticket/demanda (canal legado).", "low"),
  ferramenta("agendar_conteudo_social", "Agenda uma peça de conteúdo social já aprovada.", "low"),
];

// Médio/alto risco — ainda sem efeito público direto, mas mexem em algo que
// o cliente vê ou em dinheiro potencial: exigem aprovação, não bloqueiam
// execução automática por si só (Policy Engine decide caso a caso).
const FERRAMENTAS_RISCO_MEDIO_ALTO: VetorToolDefinition[] = [
  ferramenta("pausar_campanha_trafego", "Pausa uma campanha de tráfego pago existente.", "medium", {
    reversible: true,
  }),
  ferramenta("publicar_conteudo_social", "Publica uma peça de conteúdo social.", "medium", {
    reversible: false,
  }),
  // Gera custo real por chamada (API paga, Higgsfield) — exige aprovação
  // como qualquer outra ferramenta de risco médio, mas não é "crítica":
  // gerar um vídeo de teste não é uma ação irreversível sobre um ativo do
  // cliente, só um gasto que precisa de sinal verde antes de rodar sozinho.
  ferramenta("gerar_video_higgsfield", "Gera um vídeo a partir de uma imagem + descrição de movimento (Higgsfield).", "medium", {
    reversible: false,
    inputSchema: { required: ["imagem_url", "prompt"] },
  }),
  ferramenta("gerar_imagem_higgsfield", "Gera uma imagem/peça visual a partir de um prompt de texto (Higgsfield).", "medium", {
    reversible: false,
    inputSchema: { required: ["prompt"] },
  }),
];

// Alto risco/irreversível — nunca liberadas pra execução automática, mesmo
// com aprovação prévia de uma etapa vizinha. bloqueiaExecucaoAutomatica() em
// policyEngine.ts consulta este nível diretamente.
const FERRAMENTAS_CRITICAS: VetorToolDefinition[] = [
  ferramenta("ajustar_orcamento_trafego", "Altera o orçamento de uma campanha de tráfego pago.", "critical", {
    reversible: false,
  }),
  ferramenta("criar_campanha_trafego", "Cria uma campanha de tráfego pago nova.", "critical", {
    reversible: false,
  }),
  ferramenta("criar_audiencia", "Cria uma audiência de segmentação pra anúncios.", "critical", {
    reversible: false,
  }),
  ferramenta("enviar_mensagem_externa", "Envia mensagem a um destinatário fora da conversa atual.", "critical", {
    reversible: false,
  }),
  ferramenta("excluir_recurso", "Exclui um recurso existente (campanha, peça, conta).", "critical", {
    reversible: false,
  }),
];

export const TOOL_REGISTRY: Record<string, VetorToolDefinition> = Object.fromEntries(
  [...FERRAMENTAS_BAIXO_RISCO, ...FERRAMENTAS_RISCO_MEDIO_ALTO, ...FERRAMENTAS_CRITICAS].map((t) => [t.name, t]),
);

export class FerramentaDesconhecidaError extends Error {
  constructor(nome: string) {
    super(`Ferramenta "${nome}" não está registrada no gateway — falha fechado (tratada como crítica).`);
    this.name = "FerramentaDesconhecidaError";
  }
}

// Desconhecida = crítica: nunca assume risco baixo por omissão. Mesma postura
// fail-closed que já existia em avaliarRisco() antes desta rodada.
export function buscarFerramenta(nome: string): VetorToolDefinition {
  return (
    TOOL_REGISTRY[nome] ??
    ferramenta(nome, "Ferramenta não registrada.", "critical", { reversible: false, allowedRoles: [] })
  );
}

export interface ContextoChamadaFerramenta {
  papel: string;
  clienteId: string;
}

export interface ResultadoValidacao {
  permitido: boolean;
  motivo?: string;
  definicao: VetorToolDefinition;
}

// Valida uma chamada de ferramenta antes de executar: existe no registro,
// papel do ator tem permissão, e os campos obrigatórios do schema estão
// presentes. Não substitui o Policy Engine (risco/aprovação) — complementa.
export function validarChamadaFerramenta(
  nome: string,
  input: Record<string, unknown>,
  contexto: ContextoChamadaFerramenta,
): ResultadoValidacao {
  const definicao = buscarFerramenta(nome);

  if (!TOOL_REGISTRY[nome]) {
    return { permitido: false, motivo: `Ferramenta "${nome}" não registrada.`, definicao };
  }

  if (!definicao.allowedRoles.includes(contexto.papel)) {
    return { permitido: false, motivo: `Papel "${contexto.papel}" não autorizado para "${nome}".`, definicao };
  }

  const faltando = (definicao.inputSchema.required ?? []).filter((campo) => !(campo in input));
  if (faltando.length > 0) {
    return { permitido: false, motivo: `Campos obrigatórios ausentes: ${faltando.join(", ")}.`, definicao };
  }

  return { permitido: true, definicao };
}
