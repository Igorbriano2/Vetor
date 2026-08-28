import { describe, expect, it, vi } from "vitest";
import { MockAdapter, MODELOS_MOCK } from "./mockAdapter.js";

describe("MockAdapter", () => {
  it("listModels devolve pelo menos 1 modelo featured por kind sem provider real", async () => {
    // "voice" fica de fora aqui: desde o FishAudioAdapter (provider real),
    // o featured de voice é dele, não do mock — ver
    // apps/agentes/src/ai-providers/fishAudioAdapter.ts.
    const adapter = new MockAdapter();
    const modelos = await adapter.listModels();
    for (const kind of ["image", "video", "3d"] as const) {
      const doKind = modelos.filter((m) => m.kind === kind);
      expect(doKind.length).toBeGreaterThan(0);
      expect(doKind.some((m) => m.status === "featured")).toBe(true);
    }
    expect(modelos.some((m) => m.kind === "voice")).toBe(true);
  });

  it("generate devolve um jobId, getJobStatus começa em queued", async () => {
    const adapter = new MockAdapter();
    const modelo = MODELOS_MOCK.find((m) => m.kind === "image")!;
    const { jobId } = await adapter.generate({ kind: "image", modelId: modelo.id, quantity: 2 }, modelo);
    expect(jobId).toContain("mock:image:");
    const status = await adapter.getJobStatus(jobId);
    expect(status.status).toBe("queued");
  });

  it("job transiciona queued -> processing -> done conforme o tempo passa", async () => {
    vi.useFakeTimers();
    try {
      const adapter = new MockAdapter();
      const modelo = MODELOS_MOCK.find((m) => m.kind === "video")!;
      const { jobId } = await adapter.generate({ kind: "video", modelId: modelo.id, quantity: 1 }, modelo);

      expect((await adapter.getJobStatus(jobId)).status).toBe("queued");

      vi.advanceTimersByTime(1000);
      expect((await adapter.getJobStatus(jobId)).status).toBe("processing");

      vi.advanceTimersByTime(2000);
      const final = await adapter.getJobStatus(jobId);
      expect(final.status).toBe("done");
      expect(final.resultAssetUrls).toHaveLength(1);
      expect(final.resultAssetUrls?.[0]).toContain("mock://vetor-ai-suite/video/");
    } finally {
      vi.useRealTimers();
    }
  });

  it("done devolve exatamente 'quantity' assets falsos", async () => {
    vi.useFakeTimers();
    try {
      const adapter = new MockAdapter();
      const modelo = MODELOS_MOCK.find((m) => m.kind === "image")!;
      const { jobId } = await adapter.generate({ kind: "image", modelId: modelo.id, quantity: 4 }, modelo);
      vi.advanceTimersByTime(3000);
      const status = await adapter.getJobStatus(jobId);
      expect(status.resultAssetUrls).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("getJobStatus com jobId inválido nunca finge sucesso — falha explícita", async () => {
    const adapter = new MockAdapter();
    const status = await adapter.getJobStatus("nao-existe");
    expect(status.status).toBe("failed");
    expect(status.error).toBeTruthy();
  });
});
