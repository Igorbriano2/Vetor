import { describe, expect, it } from "vitest";
import { montarTimelineInicial, montarCaptionTrackDeSegmentos } from "./videoProjects.js";

describe("montarTimelineInicial", () => {
  it("monta uma timeline com uma faixa de vídeo e um clip cobrindo o arquivo inteiro", () => {
    const timeline = montarTimelineInicial({
      sourceAssetId: "asset-1",
      durationMs: 12345,
      width: 1080,
      height: 1920,
      fps: 30,
    }) as { tracks: Array<{ kind: string; clips: Array<Record<string, unknown>> }>; markers: unknown[]; settings: Record<string, number> };

    expect(timeline.tracks).toHaveLength(1);
    expect(timeline.tracks[0]!.kind).toBe("video");
    expect(timeline.tracks[0]!.clips).toHaveLength(1);

    const clip = timeline.tracks[0]!.clips[0]!;
    expect(clip.sourceAssetId).toBe("asset-1");
    expect(clip.startMs).toBe(0);
    expect(clip.durationMs).toBe(12345);
    expect(clip.trimInMs).toBe(0);
    // trimOut cobre a duração real inteira — nunca um valor inventado
    expect(clip.trimOutMs).toBe(12345);

    expect(timeline.markers).toEqual([]);
    expect(timeline.settings).toEqual({ fps: 30, width: 1080, height: 1920 });
  });

  it("gera ids diferentes pra faixa e pro clip a cada chamada", () => {
    const t1 = montarTimelineInicial({ sourceAssetId: "a", durationMs: 1000, width: 1, height: 1, fps: 30 }) as {
      tracks: Array<{ id: string; clips: Array<{ id: string }> }>;
    };
    const t2 = montarTimelineInicial({ sourceAssetId: "a", durationMs: 1000, width: 1, height: 1, fps: 30 }) as {
      tracks: Array<{ id: string; clips: Array<{ id: string }> }>;
    };
    expect(t1.tracks[0]!.id).not.toBe(t2.tracks[0]!.id);
    expect(t1.tracks[0]!.clips[0]!.id).not.toBe(t2.tracks[0]!.clips[0]!.id);
  });
});

describe("montarCaptionTrackDeSegmentos", () => {
  it("converte segmentos brutos em cues editáveis, cada um com id próprio", () => {
    const track = montarCaptionTrackDeSegmentos([
      { startMs: 0, endMs: 1500, text: "Olá mundo" },
      { startMs: 1500, endMs: 3200, text: "segunda fala" },
    ]);

    expect(track.language).toBe("pt-BR");
    expect(track.cues).toHaveLength(2);
    expect(track.cues[0]!.startMs).toBe(0);
    expect(track.cues[0]!.endMs).toBe(1500);
    expect(track.cues[0]!.text).toBe("Olá mundo");
    // cada cue precisa de um id próprio pra ser um layer editável
    // independente na timeline, nunca texto achatado
    expect(track.cues[0]!.id).not.toBe(track.cues[1]!.id);
    expect(typeof track.cues[0]!.id).toBe("string");
  });

  it("sem segmentos (áudio sem fala), devolve cues vazio — nunca inventa legenda", () => {
    const track = montarCaptionTrackDeSegmentos([]);
    expect(track.cues).toEqual([]);
  });
});
