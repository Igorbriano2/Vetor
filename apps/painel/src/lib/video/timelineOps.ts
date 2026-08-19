// Operações puras sobre TimelineDocument — cada função devolve um NOVO
// documento (nunca muta o argumento), o que dá undo/redo de graça pra
// quem chama (guarda o documento anterior no histórico antes de aplicar).
// Vocabulário e forma inspirados no domínio padrão de edição não
// destrutiva (mesmo raciocínio documentado em timelineTypes.ts) — nenhuma
// linha vem de nenhum projeto de terceiros.

import type { Clip, ClipTransform, Marker, Track, TrackKind, TimelineDocument } from "./timelineTypes";

function novoId(): string {
  return crypto.randomUUID();
}

const TRANSFORM_PADRAO: ClipTransform = { x: 0, y: 0, scale: 1, rotationDeg: 0, opacity: 1 };

export function adicionarFaixa(timeline: TimelineDocument, kind: TrackKind, nome: string): TimelineDocument {
  const faixa: Track = { id: novoId(), kind, name: nome, locked: false, muted: false, hidden: false, clips: [] };
  return { ...timeline, tracks: [...timeline.tracks, faixa] };
}

export function removerFaixa(timeline: TimelineDocument, trackId: string): TimelineDocument {
  return { ...timeline, tracks: timeline.tracks.filter((t) => t.id !== trackId) };
}

export interface NovoClipeParams {
  sourceAssetId: string;
  durationMs: number;
}

// Sempre acrescenta ao FIM dos clips já existentes na faixa (nunca
// sobrepõe automaticamente) — reposicionar é uma ação explícita do
// cliente depois (moverClipe).
export function adicionarClipe(timeline: TimelineDocument, trackId: string, params: NovoClipeParams): TimelineDocument {
  const faixa = timeline.tracks.find((t) => t.id === trackId);
  if (!faixa) return timeline;

  const fimDoUltimoClipe = faixa.clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);
  const clipe: Clip = {
    id: novoId(),
    sourceAssetId: params.sourceAssetId,
    startMs: fimDoUltimoClipe,
    durationMs: params.durationMs,
    trimInMs: 0,
    trimOutMs: params.durationMs,
    speed: 1,
    volume: 1,
    transform: { ...TRANSFORM_PADRAO },
    effects: [],
    keyframes: [],
  };

  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clipe] } : t)),
  };
}

export function removerClipe(timeline: TimelineDocument, clipId: string): TimelineDocument {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })),
  };
}

// Nunca deixa startMs negativo — arrastar/nudge pra antes do início da
// timeline sempre encosta em 0, nunca gera um clip "no passado".
export function moverClipe(timeline: TimelineDocument, clipId: string, novoStartMs: number): TimelineDocument {
  const inicio = Math.max(0, Math.round(novoStartMs));
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.id === clipId ? { ...c, startMs: inicio } : c)),
    })),
  };
}

export function atualizarPropriedadesClipe(
  timeline: TimelineDocument,
  clipId: string,
  patch: Partial<Pick<Clip, "volume" | "speed" | "trimInMs" | "trimOutMs">>,
): TimelineDocument {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    })),
  };
}

// Corta um clip em dois no instante absoluto `playheadMs` — só age se o
// playhead cai estritamente DENTRO do clip (nunca corta na borda ou fora,
// evita gerar um clip de duração zero). O ponto de corte preserva o
// alinhamento com a mídia original: a segunda metade herda trimIn a
// partir de onde a primeira parou, não reinicia do zero.
export function dividirClipeNoPlayhead(timeline: TimelineDocument, clipId: string, playheadMs: number): TimelineDocument {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => {
      const indice = t.clips.findIndex((c) => c.id === clipId);
      if (indice === -1) return t;
      const clipe = t.clips[indice]!;
      const fimDoClipe = clipe.startMs + clipe.durationMs;
      if (playheadMs <= clipe.startMs || playheadMs >= fimDoClipe) return t;

      const duracaoAntes = playheadMs - clipe.startMs;
      const duracaoDepois = fimDoClipe - playheadMs;
      const trimNoCorte = clipe.trimInMs + duracaoAntes * clipe.speed;

      const primeiraMetade: Clip = { ...clipe, durationMs: duracaoAntes, trimOutMs: trimNoCorte };
      const segundaMetade: Clip = {
        ...clipe,
        id: novoId(),
        startMs: playheadMs,
        durationMs: duracaoDepois,
        trimInMs: trimNoCorte,
      };

      const novosClipes = [...t.clips];
      novosClipes.splice(indice, 1, primeiraMetade, segundaMetade);
      return { ...t, clips: novosClipes };
    }),
  };
}

export function adicionarMarcador(timeline: TimelineDocument, atMs: number, label: string): TimelineDocument {
  const marcador: Marker = { id: novoId(), atMs: Math.max(0, Math.round(atMs)), label };
  return { ...timeline, markers: [...timeline.markers, marcador].sort((a, b) => a.atMs - b.atMs) };
}

export function removerMarcador(timeline: TimelineDocument, markerId: string): TimelineDocument {
  return { ...timeline, markers: timeline.markers.filter((m) => m.id !== markerId) };
}

// Duração total da timeline — o fim do clip mais tardio entre todas as
// faixas. Usada pra escala da régua de tempo e pra saber até onde o
// playhead pode ir.
export function duracaoTotalMs(timeline: TimelineDocument): number {
  let max = 0;
  for (const track of timeline.tracks) {
    for (const clip of track.clips) max = Math.max(max, clip.startMs + clip.durationMs);
  }
  return max;
}
