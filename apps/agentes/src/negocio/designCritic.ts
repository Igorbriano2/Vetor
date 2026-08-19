// DesignCritic (Parte 1, critério de aceite) — avalia a peça gerada com
// visão real (Claude lê os bytes da imagem, não só o prompt que a gerou)
// contra o checklist de qualidade ANTES do agente poder marcar a etapa
// como concluída. Fail-closed por design: qualquer falha ao obter uma
// avaliação estruturada (erro de rede, resposta sem tool_use) vira
// passed=false, nunca passed=true por omissão — "nunca declarar pronto
// sem verificação real" vale pro próprio critic também.

import Anthropic from "@anthropic-ai/sdk";

// O SDK não usa globalThis.fetch por padrão (bundla sua própria
// implementação) — sem passar `fetch` explicitamente aqui, testes que
// stubam fetch (vi.stubGlobal) não têm efeito nenhum e a chamada vaza pra
// rede de verdade. Cast necessário porque o tipo `Fetch` do SDK é
// incompatível com o `Response`/`RequestInfo` do lib.dom deste projeto.
const fetchAtual = ((...args: unknown[]) => (fetch as (...a: unknown[]) => unknown)(...args)) as unknown as NonNullable<
  ConstructorParameters<typeof Anthropic>[0]
>["fetch"];

export interface ChecklistDesignCritic {
  composicaoHierarquia: boolean;
  contraste: boolean;
  legibilidadeMobile: boolean;
  tipografia: boolean;
  proporcao: boolean;
  alinhamento: boolean;
  respiroVisual: boolean;
  cta: boolean;
  usoDaLogo: boolean;
  aderenciaBrandKit: boolean;
  adequacaoAoCanal: boolean;
  coerenciaComPedido: boolean;
}

export interface DesignCriticResultado {
  passed: boolean;
  resumo: string;
  issues: string[];
  checklist: ChecklistDesignCritic;
}

const CAMPOS_CHECKLIST = [
  "composicaoHierarquia",
  "contraste",
  "legibilidadeMobile",
  "tipografia",
  "proporcao",
  "alinhamento",
  "respiroVisual",
  "cta",
  "usoDaLogo",
  "aderenciaBrandKit",
  "adequacaoAoCanal",
  "coerenciaComPedido",
] as const;

const AVALIAR_PECA_TOOL: Anthropic.Tool = {
  name: "avaliar_peca",
  description: "Registra a avaliação de qualidade estruturada da peça visual gerada.",
  input_schema: {
    type: "object",
    properties: {
      passed: {
        type: "boolean",
        description: "true SÓ se a peça está pronta pra ir pra aprovação humana sem nenhum problema bloqueante — na dúvida, false.",
      },
      resumo: { type: "string", description: "1-2 frases sobre o veredito geral." },
      issues: {
        type: "array",
        items: { type: "string" },
        description: "Problemas concretos e acionáveis encontrados (o quê, onde, por quê) — vazio só se passed=true.",
      },
      checklist: {
        type: "object",
        properties: Object.fromEntries(CAMPOS_CHECKLIST.map((campo) => [campo, { type: "boolean" }])),
        required: [...CAMPOS_CHECKLIST],
      },
    },
    required: ["passed", "resumo", "issues", "checklist"],
  },
};

function checklistReprovadoPorFalha(motivo: string): DesignCriticResultado {
  return {
    passed: false,
    resumo: `DesignCritic não conseguiu avaliar a peça (fail-closed): ${motivo}`,
    issues: [motivo],
    checklist: Object.fromEntries(CAMPOS_CHECKLIST.map((campo) => [campo, false])) as unknown as ChecklistDesignCritic,
  };
}

export interface AvaliarPecaParams {
  imagemBytes: Buffer;
  mimeType: string;
  briefOriginal: string;
  formato: string;
  brandKit?: {
    cores?: unknown;
    fontes?: unknown;
    regras?: unknown;
    logo_area_protecao?: string | null;
    logo_tamanho_minimo?: string | null;
    logo_fundos_proibidos?: unknown;
    logo_usos_proibidos?: unknown;
  } | null;
  logoDeveriaEstarAplicada: boolean;
}

const SYSTEM_PROMPT = `Você é o DesignCritic do Vetor: um revisor de design sênior, rigoroso e honesto.
Sua função é olhar de verdade pra imagem gerada (não o prompt que a gerou) e decidir se ela está pronta
pra ir pra aprovação humana. Reprove qualquer coisa que um designer profissional reprovaria: texto cortado
ou ilegível, hierarquia confusa, contraste insuficiente, logo distorcida/ausente quando deveria estar
presente, desalinhamentos visíveis, falta de respiro visual, CTA fraco ou ausente quando o pedido pede
conversão, incoerência com o que foi pedido. Nunca aprove por educação ou porque "está quase bom" — o
padrão é pronto pra publicar, não rascunho aceitável.`;

export async function avaliarPecaDeDesign(params: AvaliarPecaParams): Promise<DesignCriticResultado> {
  const mediaType = params.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  const base64 = params.imagemBytes.toString("base64");

  const textoPedido = [
    `PEDIDO ORIGINAL / BRIEFING: ${params.briefOriginal}`,
    `FORMATO/CANAL: ${params.formato}`,
    `A logo oficial ${params.logoDeveriaEstarAplicada ? "DEVERIA estar aplicada nesta peça — confira se está presente, legível e sem distorção." : "não estava disponível pra esta peça (sem logo cadastrada) — não penalize a ausência dela."}`,
    params.brandKit
      ? `BRAND KIT (regras a respeitar): ${JSON.stringify(params.brandKit)}`
      : "Sem BrandKit cadastrado — avalie só pelos critérios gerais de qualidade.",
    "Avalie a imagem anexada contra o checklist e registre o resultado com a ferramenta avaliar_peca.",
  ].join("\n");

  try {
    // Client construído por chamada (não módulo-level): pega
    // ANTHROPIC_API_KEY no momento da chamada, não o capturado na hora em
    // que este módulo foi importado (relevante pros testes, que setam a
    // env var por caso).
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: fetchAtual });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: textoPedido },
          ],
        },
      ],
      tools: [AVALIAR_PECA_TOOL],
      tool_choice: { type: "tool", name: "avaliar_peca" },
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "avaliar_peca",
    );
    if (!toolUse) return checklistReprovadoPorFalha("o modelo não retornou uma avaliação estruturada.");

    const bruto = toolUse.input as Partial<DesignCriticResultado>;
    if (typeof bruto.passed !== "boolean" || !bruto.checklist) {
      return checklistReprovadoPorFalha("avaliação estruturada veio incompleta.");
    }

    return {
      passed: bruto.passed,
      resumo: bruto.resumo ?? "",
      issues: bruto.issues ?? [],
      checklist: bruto.checklist as ChecklistDesignCritic,
    };
  } catch (err) {
    return checklistReprovadoPorFalha(err instanceof Error ? err.message : "erro desconhecido ao chamar o modelo de avaliação.");
  }
}
