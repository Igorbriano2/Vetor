import { afterEach, describe, expect, it, vi } from "vitest";
import { selecionarWakeWordEngine, NenhumProviderDisponivelError } from "./selectProvider";
import { OpenWakeWordEngine } from "./providers/openWakeWordEngine";

const CONFIG = { keyword: "vetor" as const };

describe("selecionarWakeWordEngine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("propaga um erro que NÃO é WakeWordUnavailableError em vez de tratar como 'indisponível por design' (isso é bug de verdade, não falta de modelo)", async () => {
    vi.spyOn(OpenWakeWordEngine.prototype, "initialize").mockRejectedValue(new Error("bug inesperado no fetch do modelo"));
    await expect(selecionarWakeWordEngine(CONFIG)).rejects.toThrow("bug inesperado no fetch do modelo");
  });

  it("forcarProvider: 'mock' sempre devolve o mock, usado em testes/dev", async () => {
    const { engine, provider } = await selecionarWakeWordEngine(CONFIG, { forcarProvider: "mock" });
    expect(provider).toBe("mock");
    expect(engine).toBeDefined();
  });

  it(
    "ambiente sem navegador (sem window/fetch utilizável): os 3 providers de produção falham e o erro agregado " +
      "lista os 3 motivos — nunca finge que algum ficou disponível (representa hoje um browser sem suporte a nenhum)",
    async () => {
      await expect(selecionarWakeWordEngine(CONFIG)).rejects.toBeInstanceOf(NenhumProviderDisponivelError);
      try {
        await selecionarWakeWordEngine(CONFIG);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(NenhumProviderDisponivelError);
        const falhas = (err as NenhumProviderDisponivelError).falhas;
        expect(falhas.map((f) => f.provider).sort()).toEqual(
          ["browser-speech-fallback", "openwakeword-wasm", "porcupine-web"].sort(),
        );
      }
    },
  );
});
