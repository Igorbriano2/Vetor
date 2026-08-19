import { describe, expect, it } from "vitest";
import {
  adicionarClipe,
  adicionarFaixa,
  adicionarMarcador,
  atualizarPropriedadesClipe,
  dividirClipeNoPlayhead,
  duracaoTotalMs,
  moverClipe,
  removerClipe,
  removerFaixa,
  removerMarcador,
} from "./timelineOps";
import { criarTimelineVazia } from "./timelineTypes";

const SETTINGS = { fps: 30, width: 1080, height: 1920 };

describe("adicionarFaixa / removerFaixa", () => {
  it("adiciona uma faixa vazia e preserva as demais", () => {
    const t0 = criarTimelineVazia(SETTINGS);
    const t1 = adicionarFaixa(t0, "video", "Vídeo principal");
    expect(t1.tracks).toHaveLength(1);
    expect(t1.tracks[0]!.kind).toBe("video");
    expect(t1.tracks[0]!.clips).toEqual([]);
    // nunca muta o original (base pro undo/redo)
    expect(t0.tracks).toHaveLength(0);
  });

  it("remove só a faixa pedida", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "A");
    t = adicionarFaixa(t, "audio", "B");
    const idParaRemover = t.tracks[0]!.id;
    const depois = removerFaixa(t, idParaRemover);
    expect(depois.tracks).toHaveLength(1);
    expect(depois.tracks[0]!.name).toBe("B");
  });
});

describe("adicionarClipe", () => {
  it("acrescenta o clip no fim dos já existentes na faixa, nunca sobrepõe", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    const trackId = t.tracks[0]!.id;
    t = adicionarClipe(t, trackId, { sourceAssetId: "asset-1", durationMs: 3000 });
    t = adicionarClipe(t, trackId, { sourceAssetId: "asset-2", durationMs: 2000 });

    const [clip1, clip2] = t.tracks[0]!.clips;
    expect(clip1!.startMs).toBe(0);
    expect(clip1!.durationMs).toBe(3000);
    expect(clip2!.startMs).toBe(3000);
    expect(clip2!.durationMs).toBe(2000);
  });

  it("ignora silenciosamente se a faixa não existe (nunca lança em id inválido)", () => {
    const t = criarTimelineVazia(SETTINGS);
    const depois = adicionarClipe(t, "faixa-inexistente", { sourceAssetId: "x", durationMs: 1000 });
    expect(depois).toBe(t);
  });
});

describe("moverClipe", () => {
  it("atualiza o startMs do clip certo", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 1000 });
    const clipId = t.tracks[0]!.clips[0]!.id;

    const depois = moverClipe(t, clipId, 5000);
    expect(depois.tracks[0]!.clips[0]!.startMs).toBe(5000);
  });

  it("nunca deixa startMs negativo", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 1000 });
    const clipId = t.tracks[0]!.clips[0]!.id;

    const depois = moverClipe(t, clipId, -500);
    expect(depois.tracks[0]!.clips[0]!.startMs).toBe(0);
  });
});

describe("removerClipe", () => {
  it("remove o clip de qualquer faixa em que ele esteja", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 1000 });
    const clipId = t.tracks[0]!.clips[0]!.id;

    const depois = removerClipe(t, clipId);
    expect(depois.tracks[0]!.clips).toHaveLength(0);
  });
});

describe("atualizarPropriedadesClipe", () => {
  it("aplica só os campos passados, preserva o resto", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 1000 });
    const clipId = t.tracks[0]!.clips[0]!.id;

    const depois = atualizarPropriedadesClipe(t, clipId, { volume: 0.5 });
    const clip = depois.tracks[0]!.clips[0]!;
    expect(clip.volume).toBe(0.5);
    expect(clip.speed).toBe(1);
    expect(clip.durationMs).toBe(1000);
  });
});

describe("dividirClipeNoPlayhead", () => {
  it("corta um clip em dois, preservando o alinhamento com a mídia original", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 10000 });
    const clipId = t.tracks[0]!.clips[0]!.id;

    const depois = dividirClipeNoPlayhead(t, clipId, 4000);
    const [primeira, segunda] = depois.tracks[0]!.clips;

    expect(primeira!.startMs).toBe(0);
    expect(primeira!.durationMs).toBe(4000);
    expect(primeira!.trimOutMs).toBe(4000);

    expect(segunda!.startMs).toBe(4000);
    expect(segunda!.durationMs).toBe(6000);
    expect(segunda!.trimInMs).toBe(4000);
    // ids diferentes — são dois clips agora, não referências ao mesmo objeto
    expect(segunda!.id).not.toBe(primeira!.id);
  });

  it("não corta se o playhead cai fora do clip (evita clip de duração zero)", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 1000 });
    const clipId = t.tracks[0]!.clips[0]!.id;

    const depois = dividirClipeNoPlayhead(t, clipId, 1000); // exatamente na borda
    expect(depois.tracks[0]!.clips).toHaveLength(1);
  });

  it("respeita o speed do clip ao calcular o ponto de corte na mídia original", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 10000 });
    const clipId = t.tracks[0]!.clips[0]!.id;
    t = atualizarPropriedadesClipe(t, clipId, { speed: 2 });

    const depois = dividirClipeNoPlayhead(t, clipId, 4000);
    // 4000ms de timeline a 2x = 8000ms consumidos da mídia original
    expect(depois.tracks[0]!.clips[0]!.trimOutMs).toBe(8000);
  });
});

describe("adicionarMarcador / removerMarcador", () => {
  it("adiciona marcadores ordenados por atMs", () => {
    let t = adicionarMarcador(criarTimelineVazia(SETTINGS), 5000, "Segundo");
    t = adicionarMarcador(t, 1000, "Primeiro");
    expect(t.markers.map((m) => m.label)).toEqual(["Primeiro", "Segundo"]);
  });

  it("remove o marcador certo", () => {
    let t = adicionarMarcador(criarTimelineVazia(SETTINGS), 1000, "X");
    const id = t.markers[0]!.id;
    t = removerMarcador(t, id);
    expect(t.markers).toHaveLength(0);
  });
});

describe("duracaoTotalMs", () => {
  it("é o fim do clip mais tardio entre todas as faixas", () => {
    let t = adicionarFaixa(criarTimelineVazia(SETTINGS), "video", "V");
    t = adicionarFaixa(t, "audio", "A");
    t = adicionarClipe(t, t.tracks[0]!.id, { sourceAssetId: "a", durationMs: 3000 });
    t = adicionarClipe(t, t.tracks[1]!.id, { sourceAssetId: "b", durationMs: 10000 });

    expect(duracaoTotalMs(t)).toBe(10000);
  });

  it("é 0 pra uma timeline vazia", () => {
    expect(duracaoTotalMs(criarTimelineVazia(SETTINGS))).toBe(0);
  });
});
