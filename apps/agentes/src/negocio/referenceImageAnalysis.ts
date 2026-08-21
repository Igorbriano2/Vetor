// ReferenceImageProfile (Fase 2 do reset de produto, docs/PRODUCT-RESET-AUDIT.md)
// — generaliza referenceVideoAnalysis.ts pra referências ESTÁTICAS (imagem).
// Mesma postura fail-closed: todo campo vem de leitura real via Claude
// vision sobre a imagem real, nunca inventado. Sem sinal mecânico (ffmpeg)
// aqui — não existe corte/áudio numa imagem parada.

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { buscarAtivoPorId, baixarBytesDoAtivo } from "./businessAssets.js";

// Mesmo workaround do designCritic.ts/referenceVideoAnalysis.ts: o SDK não
// usa globalThis.fetch por padrão, então testes que stubam fetch não têm
// efeito sem isso.
const fetchAtual = ((...args: unknown[]) => (fetch as (...a: unknown[]) => unknown)(...args)) as unknown as NonNullable<
  ConstructorParameters<typeof Anthropic>[0]
>["fetch"];

export interface PerfilVisualDeImagem {
  composicao: string;
  grid: string;
  hierarquia: string;
  paleta: string;
  ritmoVisual: string;
  densidade: string;
  tipografiaDescricao: string;
  tratamentoImagem: string;
  // Fase 3 do Vetor Manager UX — mesma chamada, campo a mais: uma frase
  // curta em linguagem de cliente (não de designer), pro tipo "Você
  // escolheu uma estética editorial, escura e premium". Gerado pelo mesmo
  // Claude que já olhou a imagem, nunca uma heurística de texto sobre os
  // campos técnicos acima.
  resumoSimples: string;
}

const AVALIAR_PERFIL_TOOL: Anthropic.Tool = {
  name: "avaliar_perfil_visual",
  description: "Registra a leitura visual estruturada de uma imagem de referência.",
  input_schema: {
    type: "object",
    properties: {
      composicao: { type: "string", description: "Como os elementos estão organizados no quadro — enquadramento, foco, uso do espaço." },
      grid: { type: "string", description: "Estrutura de grade/alinhamento observada (ex: colunas, simetria, margens), em linguagem descritiva." },
      hierarquia: { type: "string", description: "O que chama atenção primeiro, segundo, terceiro — como o olho é guiado pela peça." },
      paleta: { type: "string", description: "Cores dominantes e como se relacionam (contraste, saturação, temperatura)." },
      ritmoVisual: { type: "string", description: "Sensação de movimento/estática transmitida pela composição (ex: dinâmico, calmo, tenso)." },
      densidade: { type: "string", description: "Quanto a peça usa de espaço vazio vs. elementos — minimalista, densa, equilibrada." },
      tipografiaDescricao: {
        type: "string",
        description: "Descrição do estilo tipográfico visível (peso, forma, estilo) — nunca o texto literal escrito na peça.",
      },
      tratamentoImagem: { type: "string", description: "Tratamento fotográfico/gráfico observado (ex: filtro, textura, iluminação, ilustração vs. foto)." },
      resumoSimples: {
        type: "string",
        description:
          "Uma frase curta (máx. 20 palavras), em português simples pra um pequeno empresário sem vocabulário de design entender — ex: 'Uma estética editorial, escura e premium.' Nunca jargão técnico (nada de 'grid', 'hierarquia visual', etc. nesta frase).",
      },
    },
    required: ["composicao", "grid", "hierarquia", "paleta", "ritmoVisual", "densidade", "tipografiaDescricao", "tratamentoImagem", "resumoSimples"],
  },
};

const SYSTEM_PROMPT = `Você é um analista de estilo visual do Vetor. Recebe uma imagem de referência real e descreve
APENAS a linguagem visual observável — composição, grid, hierarquia, paleta, ritmo, densidade, tipografia
(descrita, nunca o texto literal) e tratamento de imagem. Nunca copie ou transcreva texto, nome de marca,
rosto de pessoa real ou marca d'água — o objetivo é um perfil abstrato de ESTILO, não uma cópia do conteúdo.
Seja objetivo e específico, como uma nota técnica pra outro designer replicar o estilo, nunca o conteúdo.`;

// Falha aqui NUNCA vira um perfil inventado — propaga o erro (mesma postura
// fail-closed do DesignCritic/referenceVideoAnalysis.ts).
export async function avaliarPerfilVisualDeImagem(imagemBytes: Buffer, mimeType: string): Promise<PerfilVisualDeImagem> {
  const mediaType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: fetchAtual });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imagemBytes.toString("base64") } },
          { type: "text", text: "Avalie a imagem acima e registre a leitura com a ferramenta avaliar_perfil_visual." },
        ],
      },
    ],
    tools: [AVALIAR_PERFIL_TOOL],
    tool_choice: { type: "tool", name: "avaliar_perfil_visual" },
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "avaliar_perfil_visual",
  );
  if (!toolUse) throw new Error("O modelo não retornou uma leitura visual estruturada.");

  return toolUse.input as PerfilVisualDeImagem;
}

export interface ReferenceImageProfileCriado extends PerfilVisualDeImagem {
  id: string;
  referenceLibraryItemId: string | null;
}

// Orquestra a análise completa de um asset de imagem já enviado pelo cliente
// (Drive) e persiste o resultado — cada chamada gera uma linha nova, análise
// é imutável (mesmo padrão de reference_video_profiles).
export async function gerarPerfilVisualDeReferencia(params: {
  clienteId: string;
  assetId: string;
  referenceLibraryItemId?: string;
}): Promise<ReferenceImageProfileCriado> {
  const asset = await buscarAtivoPorId(params.assetId);
  if (!asset) throw new Error("Ativo de imagem não encontrado.");
  if (!asset.mimeType?.startsWith("image/")) throw new Error("Este ativo não é uma imagem.");

  const bytes = await baixarBytesDoAtivo(params.assetId);
  if (!bytes) throw new Error("Não consegui baixar o arquivo dessa referência.");

  const perfil = await avaliarPerfilVisualDeImagem(bytes, asset.mimeType);

  const { data: linha, error } = await supabase
    .from("reference_image_profiles")
    .insert({
      cliente_id: params.clienteId,
      source_asset_id: params.assetId,
      reference_library_item_id: params.referenceLibraryItemId ?? null,
      composicao: perfil.composicao,
      grid: perfil.grid,
      hierarquia: perfil.hierarquia,
      paleta: perfil.paleta,
      ritmo_visual: perfil.ritmoVisual,
      densidade: perfil.densidade,
      tipografia_descricao: perfil.tipografiaDescricao,
      tratamento_imagem: perfil.tratamentoImagem,
      resumo_simples: perfil.resumoSimples,
    })
    .select("id")
    .single();

  if (error || !linha) throw new Error(`Falha ao salvar o perfil visual de referência: ${error?.message ?? "erro desconhecido"}`);

  return { id: linha.id as string, referenceLibraryItemId: params.referenceLibraryItemId ?? null, ...perfil };
}
