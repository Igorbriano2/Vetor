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
  // Design profissional V1 (camadas reais) — critérios ADICIONAIS sobre a
  // nova estrutura em camadas, opcional pra nunca quebrar quem já consome
  // DesignCriticResultado do fluxo antigo (gerar_imagem, sem camadas).
  // Nunca substitui o checklist visual acima — "não reescreva o Critic
  // inteiro" (pedido explícito do dono do produto).
  criteriosEstruturais?: CriteriosEstruturaisDesignCritic;
}

// hasEditableTextLayers/hasIndependentLogoLayer/safeAreaValid/brandAssetValid
// são calculados em CÓDIGO a partir do que foi de fato construído (nunca
// perguntado à visão computacional — um PNG achatado final não revela se o
// texto era um objeto Fabric real ou pixel cozido, então pedir pra visão
// "adivinhar" isso seria inventar certeza que ela não tem). Só
// backgroundHasEmbeddedTextRisk é uma pergunta genuinamente visual
// (ver avaliarRiscoDeTextoNoFundo abaixo) — por isso é o único campo cuja
// polaridade é invertida (true = RISCO, não "critério passou"; os outros
// quatro seguem a convenção "true = ok" do resto do checklist).
export interface CriteriosEstruturaisDesignCritic {
  hasEditableTextLayers: boolean;
  hasIndependentLogoLayer: boolean;
  backgroundHasEmbeddedTextRisk: boolean;
  safeAreaValid: boolean;
  brandAssetValid: boolean;
}

// Calcula os 4 critérios que o próprio código já sabe responder com
// certeza — nenhum deles é um palpite. `camposDeTextoObrigatorios` são os
// campos (headline/subheadline/cta/caption) que o briefing pediu;
// `camposDeTextoPresentes` são os que de fato viraram Textbox real (ver
// designProjects.ts::montarCanvasJsonEmCamadas).
export function calcularCriteriosEstruturais(params: {
  camposDeTextoObrigatorios: string[];
  camposDeTextoPresentes: string[];
  logoObrigatoria: boolean;
  logoPresenteComoCamadaIndependente: boolean;
  areaSeguraValidaParaTodasAsCamadas: boolean;
  ativosDeMarcaValidos: boolean;
}): Pick<CriteriosEstruturaisDesignCritic, "hasEditableTextLayers" | "hasIndependentLogoLayer" | "safeAreaValid" | "brandAssetValid"> {
  const todosOsCamposObrigatoriosViraramCamada = params.camposDeTextoObrigatorios.every((campo) =>
    params.camposDeTextoPresentes.includes(campo),
  );

  return {
    hasEditableTextLayers: todosOsCamposObrigatoriosViraramCamada,
    hasIndependentLogoLayer: params.logoObrigatoria ? params.logoPresenteComoCamadaIndependente : true,
    safeAreaValid: params.areaSeguraValidaParaTodasAsCamadas,
    brandAssetValid: params.ativosDeMarcaValidos,
  };
}

const MENSAGEM_POR_CRITERIO_ESTRUTURAL: Record<keyof CriteriosEstruturaisDesignCritic, string> = {
  hasEditableTextLayers: "Nem todo campo de texto obrigatório do briefing virou uma camada de texto editável real.",
  hasIndependentLogoLayer: "A logo oficial não está presente como camada independente (só pode estar cozida no fundo, ou ausente).",
  backgroundHasEmbeddedTextRisk: "O fundo gerado pela IA parece conter texto/logo legível cozido nos pixels — nunca deveria, é responsabilidade só da composição.",
  safeAreaValid: "Algum elemento de texto/CTA invade a margem de segurança do formato.",
  brandAssetValid: "Um ativo de marca referenciado (logo/produto) não é válido pra este cliente.",
};

// Combina o veredito visual (checklist de 12 critérios, avaliado sobre o
// preview final composto) com os critérios estruturais da V1 — reprova a
// peça se qualquer um dos dois falhar, nunca marca como aprovada só porque
// o visual ficou bonito enquanto a estrutura de camadas está errada.
export function combinarComCriteriosEstruturais(
  resultado: DesignCriticResultado,
  estruturais: CriteriosEstruturaisDesignCritic,
): DesignCriticResultado {
  const problemas = (Object.keys(estruturais) as Array<keyof CriteriosEstruturaisDesignCritic>).filter((campo) => {
    const valor = estruturais[campo];
    // backgroundHasEmbeddedTextRisk é o único campo "true = ruim" — os
    // demais são "true = ok".
    return campo === "backgroundHasEmbeddedTextRisk" ? valor : !valor;
  });

  return {
    ...resultado,
    passed: resultado.passed && problemas.length === 0,
    issues: [...resultado.issues, ...problemas.map((campo) => MENSAGEM_POR_CRITERIO_ESTRUTURAL[campo])],
    criteriosEstruturais: estruturais,
  };
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

const AVALIAR_FUNDO_TOOL: Anthropic.Tool = {
  name: "avaliar_risco_de_texto",
  description: "Registra se a imagem de fundo contém texto, número ou logotipo legível cozido nos pixels.",
  input_schema: {
    type: "object",
    properties: {
      contemTextoOuLogoLegivel: {
        type: "boolean",
        description: "true se há QUALQUER letra, palavra, número ou logotipo legível na imagem — mesmo pequeno ou parcial. false só se a imagem for puramente visual (cena/textura/composição), sem nenhuma tipografia.",
      },
      observacao: { type: "string", description: "1 frase justificando o veredito." },
    },
    required: ["contemTextoOuLogoLegivel", "observacao"],
  },
};

const SYSTEM_PROMPT_FUNDO = `Você audita imagens de fundo geradas por IA pro Vetor. Sua ÚNICA pergunta é: essa imagem
contém texto, número ou logotipo legível desenhado nos pixels? Fundos devem ser puramente visuais (cena,
textura, composição, iluminação) — nenhuma tipografia. Seja rigoroso: até um texto pequeno, borrado ou
parcialmente visível conta como risco. Ignore completamente qualidade artística — só responda a pergunta
de risco de texto/logo.`;

// Pergunta genuinamente visual (nunca inferida em código, ver comentário
// em CriteriosEstruturaisDesignCritic) — roda sobre a imagem de FUNDO
// isolada, antes de qualquer composição de texto/logo real por cima.
// Fail-closed: qualquer falha na chamada assume risco=true (nunca declara
// "sem risco" por omissão — mesma postura do resto do Critic).
export async function avaliarRiscoDeTextoNoFundo(imagemBytes: Buffer, mimeType: string): Promise<boolean> {
  const mediaType = mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  const base64 = imagemBytes.toString("base64");

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: fetchAtual });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT_FUNDO,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Avalie essa imagem de fundo e registre com a ferramenta avaliar_risco_de_texto." },
          ],
        },
      ],
      tools: [AVALIAR_FUNDO_TOOL],
      tool_choice: { type: "tool", name: "avaliar_risco_de_texto" },
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "avaliar_risco_de_texto",
    );
    if (!toolUse) return true;

    const bruto = toolUse.input as { contemTextoOuLogoLegivel?: unknown };
    return typeof bruto.contemTextoOuLogoLegivel === "boolean" ? bruto.contemTextoOuLogoLegivel : true;
  } catch {
    return true;
  }
}
