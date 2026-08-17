import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt } from "./prompts/index.js";
import { processarComAgente, REGISTRAR_TICKET_TOOL, TRANSFERIR_HUMANO_TOOL, type ContextoCliente } from "./core.js";
import { transcreverAudio, TranscricaoIndisponivelError } from "../integrations/transcricao.js";
import { sintetizarFala, SinteseVozIndisponivelError } from "../integrations/tts.js";
import { avaliarRisco, precisaAprovacao, type Risco } from "../missions/policyEngine.js";
import { transicionarSolicitacao, type SolicitacaoStatus } from "../missions/stateMachine.js";

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

// Fase 3 — persistência de conversa/solicitação. Origem só cobre os canais que
// passam por este módulo (comando do painel); WhatsApp continua no Secretário,
// sem tocar nestas tabelas nesta rodada.
export type SolicitacaoOrigem = "painel_texto" | "painel_audio";

// Status em que uma solicitação ainda é "a mesma conversa em aberto" — uma
// segunda mensagem do cliente reaproveita essa linha em vez de abrir outra.
const SOLICITACAO_STATUS_ABERTO: SolicitacaoStatus[] = [
  "received",
  "transcribing",
  "understanding",
  "awaiting_context",
  "planned",
];

// Reaproveita a conversa se o conversationId veio do painel e pertence a este
// cliente; senão cria uma nova. Nunca confia cegamente num id vindo do
// navegador — se não bater com o cliente autenticado, começa uma conversa nova
// em vez de vazar/reaproveitar a de outro cliente.
async function resolverConversa(
  clienteId: string,
  usuarioId: string | undefined,
  origem: SolicitacaoOrigem,
  conversationId?: string,
): Promise<string> {
  if (conversationId) {
    const { data } = await supabase
      .from("conversas")
      .select("id")
      .eq("id", conversationId)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (data) {
      await supabase
        .from("conversas")
        .update({ ultima_mensagem_em: new Date().toISOString() })
        .eq("id", conversationId);
      return data.id as string;
    }
  }

  const { data: nova, error } = await supabase
    .from("conversas")
    .insert({ cliente_id: clienteId, usuario_id: usuarioId ?? null, origem })
    .select("id")
    .single();
  if (error || !nova) throw new Error(`Falha ao criar conversa: ${error?.message}`);
  return nova.id as string;
}

// Reaproveita a solicitação mais recente da conversa se ainda estiver "em
// aberto" (nenhuma decisão final tomada); senão cria uma nova em "received".
async function resolverSolicitacaoAberta(
  clienteId: string,
  conversaId: string,
  origem: SolicitacaoOrigem,
): Promise<{ id: string; status: SolicitacaoStatus }> {
  const { data: aberta } = await supabase
    .from("solicitacoes")
    .select("id, status")
    .eq("conversa_id", conversaId)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aberta && SOLICITACAO_STATUS_ABERTO.includes(aberta.status as SolicitacaoStatus)) {
    return { id: aberta.id as string, status: aberta.status as SolicitacaoStatus };
  }

  const { data: nova, error } = await supabase
    .from("solicitacoes")
    .insert({ cliente_id: clienteId, conversa_id: conversaId, origem, status: "received" })
    .select("id, status")
    .single();
  if (error || !nova) throw new Error(`Falha ao criar solicitação: ${error?.message}`);
  return { id: nova.id as string, status: nova.status as SolicitacaoStatus };
}

// Única porta de escrita pro status de solicitação — sempre valida a
// transição pela state machine antes de gravar (mesma postura de defesa em
// profundidade do Mission Orchestrator).
async function avancarSolicitacao(
  id: string,
  atual: SolicitacaoStatus,
  proximo: SolicitacaoStatus,
  campos: Record<string, unknown> = {},
): Promise<void> {
  transicionarSolicitacao(atual, proximo);
  await supabase
    .from("solicitacoes")
    .update({ status: proximo, updated_at: new Date().toISOString(), ...campos })
    .eq("id", id);
}

const LABEL_TIPO_MEMORIA: Record<string, string> = {
  fato: "Fato",
  preferencia: "Preferência",
  decisao: "Decisão aprovada",
  hipotese: "Hipótese anterior",
  resultado_experimento: "Resultado de experimento",
  feedback: "Feedback do cliente",
  restricao: "Restrição",
};

// Fase 7 — memória operacional mínima: além do perfil/brand kit estáticos,
// traz os últimos fatos/decisões/resultados registrados, cada um rotulado com
// confiança e origem — o Vetor nunca deve tratar um resultado antigo (ex: um
// experimento de baixa confiança de 2 meses atrás) como fato definitivo hoje.
async function buscarContextoDeNegocio(clienteId: string): Promise<string> {
  const [{ data: perfil }, { data: brandKit }, { data: memorias }] = await Promise.all([
    supabase.from("business_profiles").select("descricao, tom, ofertas, publico").eq("cliente_id", clienteId).maybeSingle(),
    supabase.from("brand_kits").select("cores, fontes, regras").eq("cliente_id", clienteId).eq("is_atual", true).maybeSingle(),
    supabase
      .from("memoria_operacional")
      .select("tipo, conteudo, confianca, origem, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const partes: string[] = [];
  if (perfil?.descricao) partes.push(`Perfil de negócio: ${perfil.descricao}`);
  if (perfil?.tom) partes.push(`Tom de voz: ${perfil.tom}`);
  if (brandKit) partes.push(`Brand kit cadastrado: ${JSON.stringify(brandKit)}`);

  if (memorias && memorias.length > 0) {
    const linhas = memorias.map(
      (m) => `- [${LABEL_TIPO_MEMORIA[m.tipo] ?? m.tipo} · confiança ${m.confianca} · ${m.origem}] ${m.conteudo}`,
    );
    partes.push(`Memória operacional recente (não trate confiança "low" como fato definitivo):\n${linhas.join("\n")}`);
  }

  return partes.length > 0 ? partes.join("\n") : "";
}

// Fase 3 — histórico escopado pela conversa (não mais todo o histórico do
// cliente): cada conversationId agora é uma thread própria e recuperável.
async function historicoConversa(clienteId: string, conversaId: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase
    .from("mensagens_plataforma")
    .select("direcao, texto")
    .eq("cliente_id", clienteId)
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true })
    .limit(20);

  return (data ?? []).map((m) => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.texto,
  }));
}

async function salvarMensagem(clienteId: string, direcao: "entrada" | "saida", texto: string, conversaId: string) {
  await supabase.from("mensagens_plataforma").insert({ cliente_id: clienteId, direcao, texto, conversa_id: conversaId });
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
    etapas: (input.etapas ?? []).map((e) => {
      const ferramentas = e.ferramentas ?? [];
      // Risco por etapa é SEMPRE calculado aqui no servidor a partir do
      // gateway de ferramentas — nunca aceito do LLM nem do navegador (Fase 4:
      // "o backend deve revalidar tudo... nunca confiar em risco... vindos
      // apenas do browser"). O IntentCard só exibe o que vier daqui.
      const risco = avaliarRisco(ferramentas);
      return {
        chave: e.chave,
        agente: e.agente,
        tarefa: e.tarefa,
        dependeDe: e.depende_de ?? [],
        ferramentas,
        risco,
        requerAprovacao: precisaAprovacao(risco),
      };
    }),
  };
}

export interface EtapaIntent {
  chave: string;
  agente: string;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
  risco: Risco;
  requerAprovacao: boolean;
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
  // Fase 3/4 — sempre presentes: conversationId identifica a thread
  // persistente (o painel deve reenviar em toda chamada seguinte pra
  // continuar a mesma conversa); requestId é só pra correlação/trace desta
  // chamada específica, não é persistido à parte.
  conversationId: string;
  requestId: string;
  // Id da solicitação em aberto ligada a esta conversa — o painel manda de
  // volta em POST /api/missoes (campo solicitacao_id) pra o backend linkar a
  // missão criada à solicitação e garantir que confirmar duas vezes nunca
  // cria duas missões (ver criarMissaoDeIntencao em orchestrator.ts).
  solicitacaoId: string;
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
  opcoes: {
    responderEmVoz?: boolean;
    conversationId?: string;
    usuarioId?: string;
    origem?: SolicitacaoOrigem;
  } = {},
): Promise<RespostaPlataforma> {
  const origem = opcoes.origem ?? "painel_texto";
  const requestId = randomUUID();

  const cliente = await buscarCliente(clienteId);
  const conversationId = await resolverConversa(clienteId, opcoes.usuarioId, origem, opcoes.conversationId);
  const solicitacao = await resolverSolicitacaoAberta(clienteId, conversationId, origem);
  await salvarMensagem(clienteId, "entrada", texto, conversationId);

  // "received"/"transcribing" -> "understanding": a mensagem de texto (própria
  // ou já transcrita) acabou de chegar pro Vetor entender. Se a solicitação já
  // estava mais adiante (segunda mensagem numa conversa em aberto), só atualiza
  // o texto mais recente sem forçar transição.
  let statusSolicitacao = solicitacao.status;
  if (statusSolicitacao === "received" || statusSolicitacao === "transcribing") {
    await avancarSolicitacao(solicitacao.id, statusSolicitacao, "understanding", { texto });
    statusSolicitacao = "understanding";
  } else {
    await supabase.from("solicitacoes").update({ texto, updated_at: new Date().toISOString() }).eq("id", solicitacao.id);
  }

  const historico = await historicoConversa(clienteId, conversationId);
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

  await salvarMensagem(clienteId, "saida", respostaTexto, conversationId);

  const nextAction = inferirNextAction(intent, respostaTexto);

  // "understanding" -> "planned" quando o Vetor já montou um plano; ou
  // "understanding" -> "awaiting_context" quando ainda falta informação antes
  // de decidir. Se nenhum dos dois, a solicitação continua "understanding"
  // (resposta direta, sem missão envolvida).
  if (intent && statusSolicitacao === "understanding") {
    await avancarSolicitacao(solicitacao.id, "understanding", "planned");
  } else if (nextAction === "ask_clarification" && statusSolicitacao === "understanding") {
    await avancarSolicitacao(solicitacao.id, "understanding", "awaiting_context");
  }

  const resposta: RespostaPlataforma = {
    conversationId,
    requestId,
    solicitacaoId: solicitacao.id,
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
  opcoes: { conversationId?: string; usuarioId?: string } = {},
): Promise<RespostaPlataforma> {
  const origem: SolicitacaoOrigem = "painel_audio";
  const conversationId = await resolverConversa(clienteId, opcoes.usuarioId, origem, opcoes.conversationId);
  const solicitacao = await resolverSolicitacaoAberta(clienteId, conversationId, origem);

  let statusSolicitacao = solicitacao.status;
  if (statusSolicitacao === "received") {
    await avancarSolicitacao(solicitacao.id, "received", "transcribing");
    statusSolicitacao = "transcribing";
  }

  try {
    const transcricao = await transcreverAudio(bytes, mimeType);
    // O provedor de STT atual (Whisper via texto puro) não devolve um score de
    // confiança real — grava só a transcrição, sem inventar um nível de
    // confiança (nunca fabricar dado que não temos). Gap conhecido, ver
    // relatório final: exigiria trocar pra resposta verbose_json/logprobs.
    await supabase
      .from("solicitacoes")
      .update({ transcricao, updated_at: new Date().toISOString() })
      .eq("id", solicitacao.id);

    return await processarMensagemPlataforma(clienteId, transcricao, {
      responderEmVoz: true,
      conversationId,
      usuarioId: opcoes.usuarioId,
      origem,
    });
  } catch (err) {
    if (err instanceof TranscricaoIndisponivelError) {
      // "failed" só é alcançável de received/transcribing/understanding no
      // grafo da state machine — se a solicitação já estava mais adiante
      // (awaiting_context/planned, ex: áudio chegou numa conversa que já tinha
      // um plano em aberto), não força uma transição inválida.
      try {
        await avancarSolicitacao(solicitacao.id, statusSolicitacao, "failed");
      } catch (transicaoErr) {
        console.warn(
          `Não foi possível marcar solicitação ${solicitacao.id} como "failed" a partir de "${statusSolicitacao}":`,
          transicaoErr,
        );
      }
      return {
        conversationId,
        requestId: randomUUID(),
        solicitacaoId: solicitacao.id,
        respostaTexto:
          "Recebi seu áudio, mas ainda não consigo ouvir por aqui — pode escrever a mesma coisa em texto? 🙏",
      };
    }
    throw err;
  }
}
