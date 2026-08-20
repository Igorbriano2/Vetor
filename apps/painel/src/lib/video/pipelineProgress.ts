// Fase 7 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — progresso real
// do pipeline de vídeo. video_pipeline_stages (migration 0024) define 18
// estágios, mas só 5 têm código real hoje (proxy, timeline_draft, captions,
// preview, final_render — ver docs/GRAVYX-UPGRADE-AUDIT.md/STATUS-REAL-ATUAL.md).
// Nunca mostra progresso nos outros 13 (motion/lower-thirds, trilha/efeitos
// etc.) — eles não têm nenhum código por trás ainda.

export const ETAPAS_REAIS = ["proxy", "timeline_draft", "captions", "preview", "final_render"] as const;
export type EtapaReal = (typeof ETAPAS_REAIS)[number];

export const LABEL_ETAPA_REAL: Record<EtapaReal, string> = {
  proxy: "Preview do material",
  timeline_draft: "Timeline",
  captions: "Legendas",
  preview: "Preview final",
  final_render: "Render final",
};

export interface ProgressoPipeline {
  concluidas: number;
  total: number;
  etapaAtual: EtapaReal | null;
}

export function calcularProgresso(estagios: Array<{ stage: string; status: string }>): ProgressoPipeline {
  const statusPorEtapa = new Map(estagios.map((e) => [e.stage, e.status]));
  const concluidas = ETAPAS_REAIS.filter((e) => statusPorEtapa.get(e) === "completed").length;
  const etapaAtual = ETAPAS_REAIS.find((e) => statusPorEtapa.get(e) !== "completed") ?? null;
  return { concluidas, total: ETAPAS_REAIS.length, etapaAtual };
}
