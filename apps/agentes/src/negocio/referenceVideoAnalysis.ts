// ReferenceVideoProfile (Parte 3 da evolução de Design/Vídeo) — deriva um
// perfil de estilo a partir de um vídeo de referência real anexado pelo
// cliente. Duas fontes de sinal, nunca misturadas: (1) sinal MECÂNICO real
// vindo do ffmpeg/ffprobe via apps/render (duração, dimensão, timestamps de
// corte, volume de áudio) — nunca estimado; (2) leitura VISUAL de uma
// amostra de frames reais via Claude vision — nunca inventada sem base na
// imagem. Nenhum campo do perfil final é chutado: onde a técnica disponível
// não consegue medir algo (efeitos sonoros, duração de legenda quadro a
// quadro), o campo fica vazio/false, nunca preenchido com um palpite.

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { analisarVideoDeReferencia, type SinalDeReferencia } from "../integrations/renderService.js";
import { buscarAtivoPorId, validarAtivoParaUso } from "./businessAssets.js";

// Mesmo workaround do designCritic.ts: o SDK não usa globalThis.fetch por
// padrão, então testes que stubam fetch não têm efeito sem isso.
const fetchAtual = ((...args: unknown[]) => (fetch as (...a: unknown[]) => unknown)(...args)) as unknown as NonNullable<
  ConstructorParameters<typeof Anthropic>[0]
>["fetch"];

export interface MetricasDeCorte {
  cutDensityPerMinute: number;
  averageShotDurationMs: number;
  pacing: "slow" | "medium" | "fast";
}

// Pura — thresholds documentados como heurística (nunca um "padrão da
// indústria" citado sem fonte): abaixo de 8 cortes/min o vídeo é
// predominantemente planos longos (slow); acima de 20 cortes/min já é
// corte rápido tipo reels de meme/trend (fast); entre os dois, medium.
export function calcularMetricasDeCorte(cutsMs: number[], durationMs: number): MetricasDeCorte {
  if (durationMs <= 0) throw new Error("durationMs precisa ser positivo pra calcular métricas de corte.");

  const numeroDePlanos = cutsMs.length + 1;
  const durationMinutes = durationMs / 60_000;
  const cutDensityPerMinute = Math.round((cutsMs.length / durationMinutes) * 10) / 10;
  const averageShotDurationMs = Math.round(durationMs / numeroDePlanos);
  const pacing: MetricasDeCorte["pacing"] = cutDensityPerMinute < 8 ? "slow" : cutDensityPerMinute <= 20 ? "medium" : "fast";

  return { cutDensityPerMinute, averageShotDurationMs, pacing };
}

// Pura — thresholds de dB são faixas típicas de loudness (nunca detecta se
// é MÚSICA de fato, só o volume médio geral da trilha de áudio inteira).
// null (sem trilha de áudio) vira "medium" por decisão explícita de
// fallback neutro, nunca por omissão silenciosa.
export function classificarEnergiaMusical(meanVolumeDb: number | null): "low" | "medium" | "high" {
  if (meanVolumeDb === null) return "medium";
  if (meanVolumeDb >= -14) return "high";
  if (meanVolumeDb >= -24) return "medium";
  return "low";
}

// Pura — reduz width/height pelo MDC pra um aspect ratio "9:16"/"1:1"/"16:9"
// legível, igual ao que qualquer editor de vídeo mostra.
export function calcularAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) throw new Error("width/height precisam ser positivos.");
  function mdc(a: number, b: number): number {
    return b === 0 ? a : mdc(b, a % b);
  }
  const divisor = mdc(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export interface PerfilVisual {
  hookStructure: string;
  captionStyle: { position: "top" | "center" | "bottom" | "none"; detected: boolean };
  colorProfile: string;
  compositionNotes: string;
}

const AVALIAR_ESTILO_TOOL: Anthropic.Tool = {
  name: "avaliar_estilo_visual",
  description: "Registra a leitura visual estruturada da amostra de frames do vídeo de referência.",
  input_schema: {
    type: "object",
    properties: {
      hookStructure: {
        type: "string",
        description: "1-2 frases descrevendo como o vídeo abre/prende atenção nos primeiros frames da amostra (baseado só no que é visível).",
      },
      captionStyle: {
        type: "object",
        properties: {
          position: { type: "string", enum: ["top", "center", "bottom", "none"] },
          detected: { type: "boolean", description: "true se legenda/texto sobreposto aparece em pelo menos um frame da amostra." },
        },
        required: ["position", "detected"],
      },
      colorProfile: { type: "string", description: "Descrição objetiva da paleta/tratamento de cor observado (tons, saturação, contraste)." },
      compositionNotes: { type: "string", description: "Observações de enquadramento/composição (plano, ângulo, uso do quadro) baseadas nos frames." },
    },
    required: ["hookStructure", "captionStyle", "colorProfile", "compositionNotes"],
  },
};

const SYSTEM_PROMPT = `Você é um analista de estilo de vídeo do Vetor. Recebe uma amostra de frames extraídos em
instantes reais de um vídeo de referência (nunca o vídeo inteiro) e descreve APENAS o que é visualmente
observável nesses frames — nunca infira coisas que exigiriam ver o vídeo em movimento ou ouvir o áudio
(ex: nunca alegue "usa efeitos sonoros de whoosh" ou "a legenda dura 2 segundos"). Seja objetivo e
específico, como uma nota técnica pra outro editor de vídeo replicar o estilo.`;

// Falha aqui NUNCA vira um perfil inventado — propaga o erro pro chamador
// (mesma postura fail-closed do DesignCritic, adaptada: lá "falha = reprovado",
// aqui "falha = sem perfil", porque não existe fallback honesto pra uma
// leitura visual que não aconteceu).
export async function avaliarVisualDoVideo(frames: Array<{ atMs: number; dataUrl: string }>): Promise<PerfilVisual> {
  if (frames.length === 0) {
    throw new Error("Nenhum frame de amostra disponível pra análise visual.");
  }

  const blocosDeImagem: Anthropic.ImageBlockParam[] = frames.map((frame) => {
    const [, mediaType, base64] = /^data:(image\/\w+);base64,(.+)$/.exec(frame.dataUrl) ?? [];
    if (!mediaType || !base64) throw new Error(`dataUrl de frame em formato inesperado (atMs=${frame.atMs}).`);
    return {
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png", data: base64 },
    };
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: fetchAtual });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...blocosDeImagem,
          {
            type: "text",
            text: `Os ${frames.length} frames acima foram extraídos nos instantes (ms, em ordem): ${frames.map((f) => f.atMs).join(", ")}. Avalie e registre com a ferramenta avaliar_estilo_visual.`,
          },
        ],
      },
    ],
    tools: [AVALIAR_ESTILO_TOOL],
    tool_choice: { type: "tool", name: "avaliar_estilo_visual" },
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "avaliar_estilo_visual",
  );
  if (!toolUse) throw new Error("O modelo não retornou uma leitura visual estruturada.");

  return toolUse.input as PerfilVisual;
}

export interface ReferenceVideoProfileCriado {
  id: string;
  referenceLibraryItemId: string | null;
  durationMs: number;
  aspectRatio: string;
  cutDensityPerMinute: number;
  averageShotDurationMs: number;
  pacing: "slow" | "medium" | "fast";
  hookStructure: string;
  captionStyle: PerfilVisual["captionStyle"];
  transitionsUsed: string[];
  musicEnergy: "low" | "medium" | "high";
  relativeVolumeDb: number | null;
  soundEffectsUsed: string[];
  colorProfile: string;
  compositionNotes: string;
}

// Orquestra a análise completa de um asset de vídeo já enviado pelo
// cliente (Drive) e persiste o resultado — nunca reanalisa em cima de um
// perfil existente (cada chamada gera uma linha nova, análise é imutável,
// ver migration 0025).
export async function gerarPerfilDeVideoDeReferencia(params: {
  clienteId: string;
  assetId: string;
  // Fase 3 do upgrade Gravyx (generalização da Biblioteca de Referências,
  // ver migration 0030) — quando a análise partiu de um item já catalogado
  // em reference_library_items, o id fica registrado no perfil resultante
  // (só rastreabilidade; a análise em si continua rodando sobre o asset
  // real, nunca sobre o item de catálogo). Opcional: chamadas antigas (só
  // assetId, direto do Drive) continuam funcionando sem alteração.
  referenceLibraryItemId?: string;
}): Promise<ReferenceVideoProfileCriado> {
  const validacao = await validarAtivoParaUso(params.clienteId, params.assetId);
  if (!validacao.valido) throw new Error(`Ativo inválido pra análise de referência: ${validacao.motivo}`);

  const asset = await buscarAtivoPorId(params.assetId);
  if (!asset) throw new Error("Ativo de vídeo não encontrado.");

  const sinal: SinalDeReferencia = await analisarVideoDeReferencia({ bucket: "brand-assets", storagePath: asset.storagePath });

  const metricas = calcularMetricasDeCorte(sinal.cutsMs, sinal.durationMs);
  const aspectRatio = calcularAspectRatio(sinal.width, sinal.height);
  const musicEnergy = classificarEnergiaMusical(sinal.meanVolumeDb);
  const visual = await avaliarVisualDoVideo(sinal.frames);

  // Só "cut" é reportado — a técnica de scene-detect (ver apps/render)
  // nunca diferencia fade/wipe/dissolve, então nunca inventa esses tipos
  // aqui; um array vazio significa "nenhum corte detectado" (vídeo de
  // plano único), não "sem transições".
  const transitionsUsed = sinal.cutsMs.length > 0 ? ["cut"] : [];

  const { data: linha, error } = await supabase
    .from("reference_video_profiles")
    .insert({
      cliente_id: params.clienteId,
      source_asset_id: params.assetId,
      reference_library_item_id: params.referenceLibraryItemId ?? null,
      duration_ms: sinal.durationMs,
      aspect_ratio: aspectRatio,
      cut_density_per_minute: metricas.cutDensityPerMinute,
      average_shot_duration_ms: metricas.averageShotDurationMs,
      pacing: metricas.pacing,
      hook_structure: visual.hookStructure,
      caption_style: visual.captionStyle,
      transitions_used: transitionsUsed,
      music_energy: musicEnergy,
      relative_volume_db: sinal.meanVolumeDb,
      // Sem detector de eventos de áudio hoje — nunca preenchido.
      sound_effects_used: [],
      color_profile: visual.colorProfile,
      composition_notes: visual.compositionNotes,
    })
    .select("id")
    .single();

  if (error || !linha) throw new Error(`Falha ao salvar o perfil de vídeo de referência: ${error?.message ?? "erro desconhecido"}`);

  return {
    id: linha.id as string,
    referenceLibraryItemId: params.referenceLibraryItemId ?? null,
    durationMs: sinal.durationMs,
    aspectRatio,
    cutDensityPerMinute: metricas.cutDensityPerMinute,
    averageShotDurationMs: metricas.averageShotDurationMs,
    pacing: metricas.pacing,
    hookStructure: visual.hookStructure,
    captionStyle: visual.captionStyle,
    transitionsUsed,
    musicEnergy,
    relativeVolumeDb: sinal.meanVolumeDb,
    soundEffectsUsed: [],
    colorProfile: visual.colorProfile,
    compositionNotes: visual.compositionNotes,
  };
}
