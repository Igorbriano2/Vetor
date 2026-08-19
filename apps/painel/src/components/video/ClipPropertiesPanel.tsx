"use client";

import type { Clip } from "@/lib/video/timelineTypes";

export default function ClipPropertiesPanel({
  clip,
  onChange,
  onMover,
  onRemover,
  onDividir,
}: {
  clip: Clip | null;
  onChange: (patch: Partial<Pick<Clip, "volume" | "speed" | "trimInMs" | "trimOutMs">>) => void;
  onMover: (novoStartMs: number) => void;
  onRemover: () => void;
  onDividir: () => void;
}) {
  if (!clip) {
    return (
      <div className="rounded-xl border border-areia/10 bg-petroleo-2/40 p-3">
        <p className="mono-label text-areia/50">Propriedades</p>
        <p className="mt-2 text-xs text-areia/40">Selecione um clip na timeline pra editar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-areia/10 bg-petroleo-2/40 p-3">
      <p className="mono-label text-areia/50">Propriedades do clip</p>

      <label className="mt-3 block text-xs text-areia/70">
        Início (ms)
        <input
          type="number"
          value={clip.startMs}
          onChange={(e) => onMover(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1.5 text-sm text-areia"
        />
      </label>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs text-areia/70">
          Corte início (ms)
          <input
            type="number"
            value={clip.trimInMs}
            onChange={(e) => onChange({ trimInMs: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1.5 text-sm text-areia"
          />
        </label>
        <label className="block text-xs text-areia/70">
          Corte fim (ms)
          <input
            type="number"
            value={clip.trimOutMs}
            onChange={(e) => onChange({ trimOutMs: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1.5 text-sm text-areia"
          />
        </label>
      </div>

      <label className="mt-2 block text-xs text-areia/70">
        Volume ({Math.round(clip.volume * 100)}%)
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={clip.volume}
          onChange={(e) => onChange({ volume: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      <label className="mt-2 block text-xs text-areia/70">
        Velocidade ({clip.speed.toFixed(2)}x)
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={clip.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDividir}
          className="flex-1 rounded-lg border border-menta/30 px-2 py-1.5 text-xs text-menta hover:bg-menta/10"
        >
          Dividir no playhead
        </button>
        <button
          type="button"
          onClick={onRemover}
          className="flex-1 rounded-lg border border-coral/30 px-2 py-1.5 text-xs text-coral hover:bg-coral/10"
        >
          Remover
        </button>
      </div>
    </div>
  );
}
