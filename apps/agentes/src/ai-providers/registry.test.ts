import { describe, expect, it, vi } from "vitest";
import { iniciarGeracao, consultarStatusDoJob, resolverModelo, listarTodosOsModelos } from "./registry.js";

describe("ai-providers/registry — fluxo fim a fim (Fase 1 do prompt-mestre)", () => {
  it("resolverModelo com modelId='auto' devolve um modelo real do kind pedido", async () => {
    const modelo = await resolverModelo({ kind: "image", modelId: "auto" });
    expect(modelo.kind).toBe("image");
    expect(modelo.providerId).toBe("mock");
  });

  it("resolverModelo com id explícito devolve exatamente esse modelo", async () => {
    const todos = await listarTodosOsModelos();
    const alvo = todos.find((m) => m.kind === "voice")!;
    const modelo = await resolverModelo({ kind: "voice", modelId: alvo.id });
    expect(modelo.id).toBe(alvo.id);
  });

  it("resolverModelo 'auto' pra voice escolhe o provider real (FishAudio), não o mock", async () => {
    const modelo = await resolverModelo({ kind: "voice", modelId: "auto" });
    expect(modelo.providerId).toBe("fishaudio");
  });

  it("resolverModelo com id inexistente lança erro claro, nunca inventa um modelo", async () => {
    await expect(resolverModelo({ kind: "image", modelId: "modelo-que-nao-existe" })).rejects.toThrow(/não encontrado/);
  });

  it("fluxo completo: pedido -> job -> status -> asset (o mesmo caminho que uma rota real usaria)", async () => {
    vi.useFakeTimers();
    try {
      const { jobId, modelo } = await iniciarGeracao({ kind: "image", modelId: "auto", prompt: "foto de produto", quantity: 1 });
      expect(jobId).toBeTruthy();
      expect(modelo.kind).toBe("image");

      expect((await consultarStatusDoJob(modelo.providerId, jobId)).status).toBe("queued");

      vi.advanceTimersByTime(3000);
      const final = await consultarStatusDoJob(modelo.providerId, jobId);
      expect(final.status).toBe("done");
      expect(final.resultAssetUrls).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
