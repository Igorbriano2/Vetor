import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt } from "./prompts/index.js";
import { processarComAgente, REGISTRAR_TICKET_TOOL, TRANSFERIR_HUMANO_TOOL, type ContextoCliente } from "./core.js";
import { transcreverAudio, TranscricaoIndisponivelError } from "../integrations/transcricao.js";
import { sintetizarFala, SinteseVozIndisponivelError } from "../integrations/tts.js";

// Só propõe — não grava nada no banco. A missão real só é criada quando o
// humano confirma no painel via POST /api/missoes (docs/manus-jarvis-spec/
// docs/07-api-e-eventos.md, fluxo POST /commands -> confirmar -> POST /missions).
const PROPOR_MISSAO_TOOL: Anthropic.Tool = {
  name: "propor_missao",
  description:
    "Propõe uma missão estruturada para o cliente confirmar antes de qualquer execução. Use quando " +
    "o pedido do cliente exigir trabalho de um ou mais agentes especialistas (design, tráfego, " +
    "estratégia, social media, vídeo, copy, analítico) — não use para dúvidas simples ou suporte.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      objetivo: { type: "string", description: "Resultado de negócio desejado, não a tarefa literal." },
      categoria: {
        type: "string",
        enum: ["strategy", "content", "traffic", "design", "analytics", "support"],
        description: "Categoria predominante da missão, pra o painel classificar visualmente.",
      },
      confianca: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Quão confiante você está de que entendeu o pedido corretamente.",
      },
      hipotese: { type: "string" },
      criterio_sucesso: { type: "array", items: { type: "string" } },
      perguntas: {
        type: "array",
        items: { type: "string" },
        description: "Perguntas que ainda faltam responder antes de confirmar (fica vazio se não houver).",
      },
      etapas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            chave: { type: "string", description: "Identificador curto único dentro deste plano, ex: 'design-1'." },
            agente: {
              type: "string",
              enum: ["design", "trafego", "estrategia", "growth", "social-media", "video", "analitico"],
            },
            tarefa: { type: "string" },
            depende_de: { type: "array", items: { type: "string" }, description: "Chaves de outras etapas deste plano." },
            ferramentas: { type: "array", items: { type: "string" } },
          },
          required: ["chave", "agente", "tarefa"],
        },
      },
    },
    required: ["titulo", "objetivo", "etapas"],
  },
};

async function buscarCliente(clienteId: string): Promise<(ContextoCliente & { plano_id: string | null }) | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_empresa, nicho, plano_id")
    .eq("id", clienteId)
    .maybeSingle();
  return data ?? null;
}

async function buscarContextoDeNegocio(clienteId: string): Promise<string> {
  const [{ data: perfil }, { data: brandKit }] = await Promise.all([
    supabase.from("business_profiles").select("descricao, tom, ofertas, publico").eq("cliente_id", clienteId).maybeSingle(),
    supabase.from("brand_kits").select("cores, fontes, regras").eq("cliente_id", clienteId).eq("is_atual", true).maybeSingle(),
  ]);

  const partes: string[] = [];
  if (perfil?.descricao) partes.push(`Perfil de negócio: ${perfil.descricao}`);
  if (perfil?.tom) partes.push(`Tom de voz: ${perfil.tom}`);
  if (brandKit) partes.push(`Brand kit cadastrado: ${JSON.stringify(brandKit)}`);

  return partes.length > 0 ? partes.join("\n") : "";
}

async function historicoConversa(clienteId: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase
    .from("mensagens_plataforma")
    .select("direcao, texto")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: true })
    .limit(20);

  return (data ?? []).map((m) => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.texto,
  }));
}

async function salvarMensagem(clienteId: string, direcao: "entrada" | "saida", texto: string) {
  await supabase.from("mensagens_plataforma").insert({ cliente_id: clienteId, direcao, texto });
}

function extrairMissaoProposta(toolUses: Anthropic.ToolUseBlock[]): MissaoProposta | undefined {
  const bloco = toolUses.find((t) => t.name === "propor_missao");
  if (!bloco) return undefined;

  const input = bloco.input as {
    titulo: string;
    objetivo: string;
    categoria?: CategoriaMissao;
    confianca?: ConfiancaMissao;
    hipotese?: string;
    criterio_sucesso?: string[];
    perguntas?: string[];
    etapas: Array<{ chave: string; agente: string; tarefa: string; depende_de?: string[]; ferramentas?: string[] }>;
  };

  return {
    titulo: input.titulo,
    objetivo: input.objetivo,
    category: input.categoria,
    confidence: input.confianca,
    hipotese: input.hipotese,
    criterioSucesso: input.criterio_sucesso ?? [],
    perguntas: input.perguntas ?? [],
    etapas: (input.etapas ?? []).map((e) => ({
      chave: e.chave,
      agente: e.agente,
      tarefa: e.tarefa,
      dependeDe: e.depende_de ?? [],
      ferramentas: e.ferramentas ?? [],
    })),
  };
}

export interface EtapaIntent {
  chave: string;
  agente: string;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
}

export type CategoriaMissao = "strategy" | "content" | "traffic" | "design" | "analytics" | "support";
export type ConfiancaMissao = "high" | "medium" | "low";
export type NextAction = "ask_clarification" | "show_plan";

export interface MissaoProposta {
  titulo: string;
  objetivo: string;
  hipotese?: string;
  criterioSucesso: string[];
  perguntas: string[];
  etapas: EtapaIntent[];
  category?: CategoriaMissao;
  confidence?: ConfiancaMissao;
}

export interface RespostaPlataforma {
  respostaTexto: string;
  audioBase64?: string;
  // Preenchido quando o Vetor usa o tool propor_missao — o painel renderiza o
  // IntentCard a partir daqui. Nada é gravado no banco até o humano confirmar.
  intent?: MissaoProposta;
  // Sinaliza pro painel o que fazer a seguir: mostrar o card de plano, ou
  // deixar claro que a resposta é uma pergunta de esclarecimento.
  nextAction?: NextAction;
}

function inferirNextAction(intent: MissaoProposta | undefined, respostaTexto: string): NextAction | undefined {
  if (intent) return "show_plan";
  if (respostaTexto.trim().endsWith("?")) return "ask_clarification";
  return undefined;
}

// Canal do Vetor dentro do painel: o cliente já está autenticado, então não há
// qualificação de lead como no WhatsApp — ele fala direto com o agente geral.
export async function processarMensagemPlataforma(
  clienteId: string,
  texto: string,
  opcoes: { responderEmVoz?: boolean } = {},
): Promise<RespostaPlataforma> {
  const cliente = await buscarCliente(clienteId);
  await salvarMensagem(clienteId, "entrada", texto);

  const historico = await historicoConversa(clienteId);
  const contextoNegocio = cliente ? await buscarContextoDeNegocio(clienteId) : "";

  const systemPrompt = cliente
    ? `${getSystemPrompt("vetor")}\n\nCliente autenticado no painel: ${cliente.nome_empresa} (nicho: ${cliente.nicho}, plano: ${cliente.plano_id ?? "não definido"}). Ele já é cliente pagante — não qualifique como lead, vá direto ao ponto.${contextoNegocio ? `\n\n${contextoNegocio}` : ""}`
    : `${getSystemPrompt("vetor")}\n\nNão foi possível identificar o cliente autenticado — avise que algo está errado no cadastro e sugira falar com o suporte.`;

  const resultado = await processarComAgente({
    agente: "vetor",
    systemPrompt,
    historico,
    cliente,
    origemLabel: "painel Vetor",
    tools: [REGISTRAR_TICKET_TOOL, TRANSFERIR_HUMANO_TOOL, PROPOR_MISSAO_TOOL],
  });

  const intent = extrairMissaoProposta(resultado.toolUses);
  const respostaTexto =
    resultado.respostaTexto ||
    (intent ? "Montei uma proposta de missão — dá uma olhada e confirma se está de acordo." : resultado.respostaTexto);

  await salvarMensagem(clienteId, "saida", respostaTexto);

  const nextAction = inferirNextAction(intent, respostaTexto);
  const resposta: RespostaPlataforma = {
    respostaTexto,
    ...(intent ? { intent } : {}),
    ...(nextAction ? { nextAction } : {}),
  };

  if (opcoes.responderEmVoz) {
    try {
      const audio = await sintetizarFala(respostaTexto);
      resposta.audioBase64 = Buffer.from(audio.bytes).toString("base64");
    } catch (err) {
      if (!(err instanceof SinteseVozIndisponivelError)) throw err;
      // sandbox/sem provedor configurado: devolve só o texto, sem travar o chat.
    }
  }

  return resposta;
}

export async function processarAudioPlataforma(
  clienteId: string,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<RespostaPlataforma> {
  try {
    const transcricao = await transcreverAudio(bytes, mimeType);
    return await processarMensagemPlataforma(clienteId, transcricao, { responderEmVoz: true });
  } catch (err) {
    if (err instanceof TranscricaoIndisponivelError) {
      return {
        respostaTexto:
          "Recebi seu áudio, mas ainda não consigo ouvir por aqui — pode escrever a mesma coisa em texto? 🙏",
      };
    }
    throw err;
  }
}
