"use client";

// Timeline horizontal multi-faixa — cada faixa é uma linha, cada clip é um
// bloco posicionado por tempo (px = ms * escala). Seleção de clip/faixa é
// por clique; reposicionar startMs é feito no painel de propriedades
// (input numérico), não por arrastar-e-soltar — decisão de escopo desta
// rodada (ver nota no editor), não uma limitação escondida.

import type { TimelineDocument, Track, TrackKind } from "@/lib/video/timelineTypes";

const PX_POR_MS = 0.05; // 50px = 1s
const ALTURA_FAIXA = 44;

const LABEL_POR_KIND: Record<TrackKind, string> = {
  video: "Vídeo",
  image: "Imagem",
  audio: "Áudio",
  captions: "Legendas",
  voiceover: "Locução",
  effects: "Efeitos",
};

const COR_POR_KIND: Record<TrackKind, string> = {
  video: "bg-menta/20 border-menta/40",
  image: "bg-ambar/20 border-ambar/40",
  audio: "bg-coral/20 border-coral/40",
  captions: "bg-areia/15 border-areia/30",
  voiceover: "bg-coral/20 border-coral/40",
  effects: "bg-areia/15 border-areia/30",
};

export default function VideoTimeline({
  timeline,
  selectedClipId,
  selectedTrackId,
  onSelectClip,
  onSelectTrack,
  playheadMs,
  onSeek,
  duracaoTotalMs,
}: {
  timeline: TimelineDocument;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  onSelectClip: (clipId: string, trackId: string) => void;
  onSelectTrack: (trackId: string) => void;
  playheadMs: number;
  onSeek: (ms: number) => void;
  duracaoTotalMs: number;
}) {
  const larguraTotal = Math.max(600, (duracaoTotalMs + 5000) * PX_POR_MS);

  function aoClicarNaRegua(e: React.MouseEvent<HTMLDivElement>) {
    const retangulo = e.currentTarget.getBoundingClientRect();
    const ms = Math.max(0, (e.clientX - retangulo.left) / PX_POR_MS);
    onSeek(ms);
  }

  return (
    <div className="rounded-xl border border-areia/10 bg-petroleo-2/40 p-3">
      <p className="mono-label text-areia/50">Timeline</p>

      <div className="mt-2 overflow-x-auto">
        <div style={{ width: larguraTotal }}>
          {/* Régua de tempo + marcadores + playhead */}
          <div className="relative h-6 cursor-pointer border-b border-areia/10" onClick={aoClicarNaRegua}>
            {timeline.markers.map((marcador) => (
              <div
                key={marcador.id}
                title={marcador.label}
                className="absolute top-0 h-full w-0.5 bg-ambar"
                style={{ left: marcador.atMs * PX_POR_MS }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-coral"
              style={{ left: playheadMs * PX_POR_MS }}
            />
          </div>

          {/* Faixas */}
          <div className="relative">
            {timeline.tracks.length === 0 && (
              <p className="py-6 text-center text-xs text-areia/40">Nenhuma faixa ainda — adicione uma abaixo.</p>
            )}
            {timeline.tracks.map((track) => (
              <FaixaLinha
                key={track.id}
                track={track}
                selecionada={track.id === selectedTrackId}
                selectedClipId={selectedClipId}
                onSelectClip={onSelectClip}
                onSelectTrack={onSelectTrack}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-coral"
              style={{ left: playheadMs * PX_POR_MS }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FaixaLinha({
  track,
  selecionada,
  selectedClipId,
  onSelectClip,
  onSelectTrack,
}: {
  track: Track;
  selecionada: boolean;
  selectedClipId: string | null;
  onSelectClip: (clipId: string, trackId: string) => void;
  onSelectTrack: (trackId: string) => void;
}) {
  return (
    <div
      className={`relative border-b border-areia/5 ${selecionada ? "bg-areia/5" : ""}`}
      style={{ height: ALTURA_FAIXA }}
      onClick={() => onSelectTrack(track.id)}
    >
      <span className="pointer-events-none absolute left-1 top-1 z-0 font-mono text-[10px] uppercase text-areia/30">
        {LABEL_POR_KIND[track.kind]} · {track.name}
      </span>
      {track.clips.map((clip) => (
        <button
          key={clip.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectClip(clip.id, track.id);
          }}
          className={`absolute top-3 flex h-7 items-center truncate rounded border px-1.5 text-[10px] text-areia/90 ${COR_POR_KIND[track.kind]} ${
            clip.id === selectedClipId ? "ring-2 ring-ambar" : ""
          }`}
          style={{ left: clip.startMs * PX_POR_MS, width: Math.max(20, clip.durationMs * PX_POR_MS) }}
        >
          {clip.sourceAssetId.slice(0, 8)}
        </button>
      ))}
    </div>
  );
}
