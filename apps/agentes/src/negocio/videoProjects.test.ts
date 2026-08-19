import { describe, expect, it } from "vitest";
import { montarTimelineInicial } from "./videoProjects.js";

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
