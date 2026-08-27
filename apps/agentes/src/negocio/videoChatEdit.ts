import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// "ChatCut" — chat de IA lateral dentro do editor de vídeo (auditoria do
// curso "Vendus Content Studio" apontou isso como o maior gap do editor do
// Vetor: hoje a timeline só é editável por campo numérico/arrastar, sem
// comando em linguagem natural). Este módulo nunca toca a timeline
// diretamente — só INTERPRETA o pedido do cliente e devolve um PLANO de
// operações estruturadas; quem aplica de fato é o mesmo `timelineOps.ts`
// que o editor manual já usa (undo/redo, autosave, validação — tudo
// reaproveitado, nunca duplicado aqui).

export type TipoOperacaoTimeline =
  | "remover_clipe"
  | "mover_clipe"
  | "dividir_clipe"
  | "atualizar_propriedades_clipe"
  | "adicionar_faixa"
  | "remover_faixa";

export interface OperacaoTimeline {
  tipo: TipoOperacaoTimeline;
  clip_id?: string;
  track_id?: string;
  novo_start_ms?: number;
  playhead_ms?: number;
  patch?: {
    trim_in_ms?: number;
    trim_out_ms?: number;
    speed?: number;
    volume?: number;
  };
  kind?: "video" | "image" | "audio" | "voiceover";
  nome_faixa?: string;
}

export interface ResumoClipe {
  id: string;
  trackId: string;
  trackNome: string;
  sourceAssetId: string;
  startMs: number;
  durationMs: number;
  speed: number;
  volume: number;
}

export interface ResumoTimeline {
  duracaoTotalMs: number;
  faixas: Array<{ id: string; kind: string; nome: string }>;
  clipes: ResumoClipe[];
}

export interface PlanoDeEdicao {
  resposta: string;
  operacoes: OperacaoTimeline[];
}

const APLICAR_EDICOES_TOOL: Anthropic.Tool = {
  name: "aplicar_edicoes_timeline",
  description:
    "Registra o plano de edição da timeline a partir do pedido do cliente em linguagem natural. Cada operação " +
    "vira uma chamada real das funções de edição já existentes (mesmas que o editor manual usa) — nunca inventa " +
    "um clip_id/track_id que não apareceu no resumo da timeline fornecido.",
  input_schema: {
    type: "object",
    properties: {
      resposta: {
        type: "string",
        description:
          "Resposta curta em português, em tom de editor de vídeo, explicando o que você vai fazer (ou por que não " +
          "dá pra fazer o que foi pedido — ex: pedido ambíguo, clip não encontrado). Se não houver operação nenhuma " +
          "a aplicar, explique isso aqui e deixe `operacoes` vazio.",
      },
      operacoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: ["remover_clipe", "mover_clipe", "dividir_clipe", "atualizar_propriedades_clipe", "adicionar_faixa", "remover_faixa"],
            },
            clip_id: { type: "string", description: "Obrigatório em remover_clipe/mover_clipe/dividir_clipe/atualizar_propriedades_clipe — sempre um id que já existe no resumo da timeline." },
            track_id: { type: "string", description: "Obrigatório em remover_faixa — id que já existe no resumo." },
            novo_start_ms: { type: "number", description: "Obrigatório em mover_clipe." },
            playhead_ms: { type: "number", description: "Obrigatório em dividir_clipe — ponto de corte em milissegundos, precisa estar dentro do intervalo [startMs, startMs+durationMs] do clip." },
            patch: {
              type: "object",
              description: "Usado em atualizar_propriedades_clipe — só inclua os campos que o pedido realmente pede pra mudar.",
              properties: {
                trim_in_ms: { type: "number" },
                trim_out_ms: { type: "number" },
                speed: { type: "number", description: "1 = velocidade normal, 2 = 2x mais rápido, 0.5 = câmera lenta." },
                volume: { type: "number", description: "0 a 1 (0 = mudo)." },
              },
            },
            kind: { type: "string", enum: ["video", "image", "audio", "voiceover"], description: "Obrigatório em adicionar_faixa." },
            nome_faixa: { type: "string", description: "Obrigatório em adicionar_faixa." },
          },
          required: ["tipo"],
        },
      },
    },
    required: ["resposta", "operacoes"],
  },
};

function formatarResumoTimeline(resumo: ResumoTimeline): string {
  const linhasFaixas = resumo.faixas
    .map((f) => {
      const clipesDaFaixa = resumo.clipes.filter((c) => c.trackId === f.id);
      const linhasClipes = clipesDaFaixa
        .map(
          (c, i) =>
            `    ${i + 1}. clip_id="${c.id}" — de ${c.startMs}ms até ${c.startMs + c.durationMs}ms (duração ${c.durationMs}ms), speed=${c.speed}, volume=${c.volume}`,
        )
        .join("\n");
      return `- track_id="${f.id}" (${f.kind}, "${f.nome}")${clipesDaFaixa.length ? `\n${linhasClipes}` : " — sem clipes"}`;
    })
    .join("\n");

  return `Duração total da timeline: ${resumo.duracaoTotalMs}ms.\n\nFaixas e clipes reais (use SEMPRE os ids exatos abaixo, nunca invente um novo):\n${linhasFaixas || "(nenhuma faixa ainda)"}`;
}

// Nunca aplica nada sozinho — devolve o plano pro chamador (rota do painel)
// aplicar via timelineOps no client, exatamente como uma edição manual.
// Fail-closed honesto: se o Claude não retornar a tool (raro, mas
// possível), devolve plano vazio com uma resposta genérica em vez de
// quebrar a etapa.
export async function planejarEdicoesTimeline(
  resumo: ResumoTimeline,
  mensagem: string,
  historicoChat: Array<{ role: "user" | "assistant"; texto: string }> = [],
): Promise<PlanoDeEdicao> {
  const mensagensAnteriores: Anthropic.MessageParam[] = historicoChat.map((m) => ({
    role: m.role,
    content: m.texto,
  }));

  const resposta = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system:
      "Você é o editor de vídeo assistente do VETOR, dentro do editor de timeline. O cliente pede ajustes em " +
      "linguagem natural (ex: 'corta os 3 primeiros segundos', 'deixa esse trecho mais lento', 'remove o segundo " +
      "clipe da faixa de vídeo') e você traduz isso em operações estruturadas reais sobre a timeline atual. " +
      "Nunca invente um clip_id ou track_id que não esteja no resumo fornecido — se o pedido referenciar algo que " +
      "não existe ou for ambíguo demais (ex: 'remove o clipe ruim' sem dizer qual), pergunte no campo `resposta` " +
      "em vez de chutar uma operação. Prefira o mínimo de operações que resolve o pedido.\n\n" +
      formatarResumoTimeline(resumo),
    messages: [...mensagensAnteriores, { role: "user", content: mensagem }],
    tools: [APLICAR_EDICOES_TOOL],
    tool_choice: { type: "tool", name: "aplicar_edicoes_timeline" },
  });

  const toolUse = resposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    return { resposta: "Não consegui interpretar esse pedido — tenta descrever de outro jeito?", operacoes: [] };
  }

  const input = toolUse.input as { resposta: string; operacoes: OperacaoTimeline[] };
  return { resposta: input.resposta, operacoes: input.operacoes ?? [] };
}
