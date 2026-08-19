"use client";

import type { AudioMix, CaptionTrack } from "@/lib/video/timelineTypes";

const AUDIO_MIX_PADRAO: AudioMix = {
  musicVolume: 0.6,
  duckingEnabled: true,
  duckingThresholdDb: -18,
  voiceoverVolume: 1,
  sfxVolume: 0.8,
};

export default function CaptionsAndAudioPanel({
  captions,
  audioMix,
  onChangeCaptions,
  onChangeAudioMix,
  playheadMs,
}: {
  captions?: CaptionTrack;
  audioMix?: AudioMix;
  onChangeCaptions: (novo: CaptionTrack) => void;
  onChangeAudioMix: (novo: AudioMix) => void;
  playheadMs: number;
}) {
  const mix = audioMix ?? AUDIO_MIX_PADRAO;
  const cues = captions?.cues ?? [];

  function adicionarLegenda() {
    onChangeCaptions({
      language: "pt-BR",
      cues: [...cues, { id: crypto.randomUUID(), startMs: playheadMs, endMs: playheadMs + 2000, text: "" }].sort(
        (a, b) => a.startMs - b.startMs,
      ),
    });
  }

  function atualizarLegenda(id: string, texto: string) {
    onChangeCaptions({ language: "pt-BR", cues: cues.map((c) => (c.id === id ? { ...c, text: texto } : c)) });
  }

  function removerLegenda(id: string) {
    onChangeCaptions({ language: "pt-BR", cues: cues.filter((c) => c.id !== id) });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-areia/10 bg-petroleo-2/40 p-3">
        <div className="flex items-center justify-between">
          <p className="mono-label text-areia/50">Legendas</p>
          <button type="button" onClick={adicionarLegenda} className="text-xs text-menta hover:underline">
            + no playhead
          </button>
        </div>
        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {cues.length === 0 && <p className="text-xs text-areia/40">Nenhuma legenda ainda.</p>}
          {cues.map((cue) => (
            <div key={cue.id} className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 font-mono text-[10px] text-areia/40">
                {(cue.startMs / 1000).toFixed(1)}s
              </span>
              <input
                value={cue.text}
                onChange={(e) => atualizarLegenda(cue.id, e.target.value)}
                className="flex-1 rounded border border-areia/15 bg-petroleo-2/60 px-2 py-1 text-xs text-areia"
              />
              <button type="button" onClick={() => removerLegenda(cue.id)} className="text-coral">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-areia/10 bg-petroleo-2/40 p-3">
        <p className="mono-label text-areia/50">Mix de áudio</p>
        <label className="mt-2 block text-xs text-areia/70">
          Música ({Math.round(mix.musicVolume * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mix.musicVolume}
            onChange={(e) => onChangeAudioMix({ ...mix, musicVolume: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-areia/70">
          <input
            type="checkbox"
            checked={mix.duckingEnabled}
            onChange={(e) => onChangeAudioMix({ ...mix, duckingEnabled: e.target.checked })}
          />
          Ducking automático (baixa a música quando há fala)
        </label>
        <label className="mt-2 block text-xs text-areia/70">
          Locução ({Math.round(mix.voiceoverVolume * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mix.voiceoverVolume}
            onChange={(e) => onChangeAudioMix({ ...mix, voiceoverVolume: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
      </div>
    </div>
  );
}
