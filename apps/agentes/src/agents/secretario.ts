import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt } from "./prompts/index.js";
import { sendWhatsappMessage, baixarMidiaWhatsapp } from "../integrations/whatsapp.js";
import { transcreverAudio, TranscricaoIndisponivelError } from "../integrations/transcricao.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const REGISTRAR_TICKET_TOOL: Anthropic.Tool = {
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

const TRANSFERIR_HUMANO_TOOL: Anthropic.Tool = {
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

interface ClienteExistente {
  id: string;
  nome_empresa: string;
  nicho: string;
}

async function buscarClientePorNumero(numero: string): Promise<ClienteExistente | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_empresa, nicho")
    .eq("whatsapp_numero", numero)
    .maybeSingle();
  return data ?? null;
}

async function historicoConversa(numero: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase
    .from("mensagens_whatsapp")
    .select("direcao, texto")
    .eq("numero", numero)
    .order("created_at", { ascending: true })
    .limit(20);

  return (data ?? []).map((m) => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.texto,
  }));
}

async function salvarMensagem(numero: string, direcao: "entrada" | "saida", texto: string, clienteId: string | null) {
  await supabase.from("mensagens_whatsapp").insert({ numero, direcao, texto, cliente_id: clienteId });
}

async function registrarLogAgente(acao: string, justificativa: string, clienteId: string | null, demandaId: string | null) {
  await supabase.from("log_agentes").insert({
    agente: "secretario",
    acao,
    justificativa,
    cliente_id: clienteId,
    demanda_id: demandaId,
  });
}

export async function processarMensagemRecebida(numero: string, texto: string): Promise<void> {
  const cliente = await buscarClientePorNumero(numero);
  await salvarMensagem(numero, "entrada", texto, cliente?.id ?? null);

  const historico = await historicoConversa(numero);

  const contextoSistema = cliente
    ? `${getSystemPrompt("secretario")}\n\nCliente já cadastrado: ${cliente.nome_empresa} (nicho: ${cliente.nicho}).`
    : `${getSystemPrompt("secretario")}\n\nEste número ainda não é cliente cadastrado — trate como novo lead.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: contextoSistema,
    messages: historico,
    tools: [REGISTRAR_TICKET_TOOL, TRANSFERIR_HUMANO_TOOL],
  });

  let respostaTexto = "";

  for (const block of response.content) {
    if (block.type === "text") {
      respostaTexto += block.text;
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
          cliente_id: cliente?.id ?? null,
          tipo_demanda: input.tipo_demanda,
          descricao: input.descricao,
          urgencia: input.urgencia,
        })
        .select("id")
        .single();

      await registrarLogAgente(
        "registrar_ticket",
        `Ticket criado via WhatsApp (${numero}): ${input.tipo_demanda}`,
        cliente?.id ?? null,
        demanda?.id ?? null,
      );

      if (!respostaTexto) {
        respostaTexto =
          "Show, já registrei sua demanda aqui! Nosso time vai olhar e te dar um retorno em breve. 🙌";
      }
    } else if (block.type === "tool_use" && block.name === "transferir_humano") {
      await registrarLogAgente(
        "transferir_humano",
        `Conversa transferida para humano: ${(block.input as { motivo: string }).motivo}`,
        cliente?.id ?? null,
        null,
      );
      if (!respostaTexto) {
        respostaTexto = "Entendido! Já vou chamar alguém do time pra continuar com você. Um minuto 🙏";
      }
    }
  }

  if (!respostaTexto) {
    respostaTexto = "Desculpa, não entendi direito. Pode repetir de outro jeito?";
  }

  await sendWhatsappMessage(numero, respostaTexto);
  await salvarMensagem(numero, "saida", respostaTexto, cliente?.id ?? null);
}

// Áudio recebido: baixa da Meta Cloud API, transcreve e reaproveita a mesma
// pipeline de processarMensagemRecebida — o restante do fluxo (histórico, tools,
// registro de ticket) não muda, só a origem do texto (docs/07, seção 4).
export async function processarAudioRecebido(numero: string, mediaId: string): Promise<void> {
  try {
    const midia = await baixarMidiaWhatsapp(mediaId);
    const transcricao = await transcreverAudio(midia.bytes, midia.mimeType);
    await processarMensagemRecebida(numero, transcricao);
  } catch (err) {
    if (err instanceof TranscricaoIndisponivelError) {
      await sendWhatsappMessage(
        numero,
        "Recebi seu áudio, mas ainda não consigo ouvir por aqui — pode escrever a mesma coisa em texto? 🙏",
      );
      return;
    }
    throw err;
  }
}
