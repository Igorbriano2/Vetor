import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const REGISTRAR_TICKET_TOOL: Anthropic.Tool = {
  name: "registrar_ticket",
  description:
    "Registra a demanda estruturada do cliente, depois de confirmada com ele. Use somente quando " +
    "já tiver nicho (para lead novo) ou tipo de demanda + descrição (para cliente existente), e o " +
    "cliente já tiver confirmado o resumo.",
  input_schema: {
    type: "object",
    properties: {
      tipo_demanda: { type: "string", description: "Ex: peça de design, campanha de tráfego, dúvida, reclamação, novo lead" },
      descricao: { type: "string" },
      urgencia: { type: "string", enum: ["baixa", "media", "alta"] },
      nicho: {
        type: "string",
        enum: ["restaurante_delivery", "advocacia", "arquitetura_engenharia", "saude", "estetica", "outro"],
        description: "Obrigatório apenas quando o remetente ainda não é cliente cadastrado.",
      },
    },
    required: ["tipo_demanda", "descricao", "urgencia"],
  },
};

export const TRANSFERIR_HUMANO_TOOL: Anthropic.Tool = {
  name: "transferir_humano",
  description:
    "Transfere a conversa para um humano da equipe imediatamente. Use quando o cliente pedir para " +
    "falar com uma pessoa, ou demonstrar frustração clara.",
  input_schema: {
    type: "object",
    properties: {
      motivo: { type: "string" },
    },
    required: ["motivo"],
  },
};

export interface ContextoCliente {
  id: string;
  nome_empresa: string;
  nicho: string;
}

export interface ResultadoConversa {
  respostaTexto: string;
  ticketCriado: boolean;
  transferido: boolean;
  // Blocos de tool_use que o núcleo não reconhece (ex: propor_missao) — o
  // chamador decide o que fazer com eles. Mantém core.ts sem conhecer tools
  // específicos de um único canal.
  toolUses: Anthropic.ToolUseBlock[];
}

export async function registrarLogAgente(
  agente: string,
  acao: string,
  justificativa: string,
  clienteId: string | null,
  demandaId: string | null,
) {
  await supabase.from("log_agentes").insert({
    agente,
    acao,
    justificativa,
    cliente_id: clienteId,
    demanda_id: demandaId,
  });
}

// Núcleo de entendimento compartilhado entre canais (WhatsApp, plataforma web).
// Cada canal cuida de resolver o cliente, montar o histórico no formato certo e
// entregar a resposta (texto/áudio) — a parte de "entender e decidir" é a mesma.
export async function processarComAgente(params: {
  agente: string;
  systemPrompt: string;
  historico: Anthropic.MessageParam[];
  cliente: ContextoCliente | null;
  origemLabel: string;
  tools?: Anthropic.Tool[];
}): Promise<ResultadoConversa> {
  const tools = params.tools ?? [REGISTRAR_TICKET_TOOL, TRANSFERIR_HUMANO_TOOL];
  const nomesConhecidos = new Set(["registrar_ticket", "transferir_humano"]);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: params.historico,
    tools,
  });

  let respostaTexto = "";
  let ticketCriado = false;
  let transferido = false;
  const toolUses: Anthropic.ToolUseBlock[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      respostaTexto += block.text;
    } else if (block.type === "tool_use" && !nomesConhecidos.has(block.name)) {
      toolUses.push(block);
    } else if (block.type === "tool_use" && block.name === "registrar_ticket") {
      const input = block.input as {
        tipo_demanda: string;
        descricao: string;
        urgencia: "baixa" | "media" | "alta";
        nicho?: string;
      };

      const { data: demanda } = await supabase
        .from("demandas")
        .insert({
          cliente_id: params.cliente?.id ?? null,
          tipo_demanda: input.tipo_demanda,
          descricao: input.descricao,
          urgencia: input.urgencia,
        })
        .select("id")
        .single();

      await registrarLogAgente(
        params.agente,
        "registrar_ticket",
        `Ticket criado via ${params.origemLabel}: ${input.tipo_demanda}`,
        params.cliente?.id ?? null,
        demanda?.id ?? null,
      );

      ticketCriado = true;
      if (!respostaTexto) {
        respostaTexto =
          "Show, já registrei sua demanda aqui! Nosso time vai olhar e te dar um retorno em breve. 🙌";
      }
    } else if (block.type === "tool_use" && block.name === "transferir_humano") {
      await registrarLogAgente(
        params.agente,
        "transferir_humano",
        `Conversa transferida para humano: ${(block.input as { motivo: string }).motivo}`,
        params.cliente?.id ?? null,
        null,
      );

      transferido = true;
      if (!respostaTexto) {
        respostaTexto = "Entendido! Já vou chamar alguém do time pra continuar com você. Um minuto 🙏";
      }
    }
  }

  if (!respostaTexto && toolUses.length === 0) {
    // Diagnóstico temporário: isso não deveria acontecer com stop_reason
    // "end_turn"/"tool_use" normais — só serve pra descobrir por que a API
    // devolveu conteúdo sem texto nem tool_use (ex: stop_reason "max_tokens"
    // cortando no meio, ou tipo de bloco novo que este código ainda não trata).
    console.warn(
      `[core] Resposta vazia do agente "${params.agente}" — stop_reason=${response.stop_reason}, ` +
        `blocos=${JSON.stringify(response.content.map((b) => b.type))}`,
    );
    respostaTexto = "Desculpa, não entendi direito. Pode repetir de outro jeito?";
  }

  return { respostaTexto, ticketCriado, transferido, toolUses };
}
