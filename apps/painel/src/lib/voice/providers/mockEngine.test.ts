import { describe, expect, it } from "vitest";
import { MockWakeWordEngine } from "./mockEngine";

const CONFIG = { keyword: "vetor" as const };

describe("MockWakeWordEngine", () => {
  it("nunca dispara eventos antes de start() (não envia áudio antes da wake word estar realmente ativa)", async () => {
    const engine = new MockWakeWordEngine();
    await engine.initialize(CONFIG);
    let disparou = false;
    engine.onWakeWord(() => (disparou = true));
    engine.simularWakeWord();
    expect(disparou).toBe(false);
  });

  it("dispara onWakeWord com a keyword configurada depois de start()", async () => {
    const engine = new MockWakeWordEngine();
    await engine.initialize(CONFIG);
    await engine.start();

    let evento: { keyword: string } | undefined;
    engine.onWakeWord((e) => (evento = e));
    engine.simularWakeWord();
    expect(evento?.keyword).toBe("vetor");
  });

  it("pause() suprime novos eventos sem precisar chamar stop()", async () => {
    const engine = new MockWakeWordEngine();
    await engine.initialize(CONFIG);
    await engine.start();
    await engine.pause();

    let disparou = false;
    engine.onWakeWord(() => (disparou = true));
    engine.simularWakeWord();
    expect(disparou).toBe(false);
  });

  it("stop() encerra o engine — simular depois disso não faz nada", async () => {
    const engine = new MockWakeWordEngine();
    await engine.initialize(CONFIG);
    await engine.start();
    await engine.stop();

    let disparou = false;
    engine.onWakeWord(() => (disparou = true));
    engine.simularWakeWord();
    expect(disparou).toBe(false);
    expect(engine.estaAtivo).toBe(false);
  });

  it("a função de unsubscribe devolvida por onWakeWord remove o listener", async () => {
    const engine = new MockWakeWordEngine();
    await engine.initialize(CONFIG);
    await engine.start();

    let contagem = 0;
    const cancelar = engine.onWakeWord(() => contagem++);
    engine.simularWakeWord();
    cancelar();
    engine.simularWakeWord();
    expect(contagem).toBe(1);
  });

  it("onSpeechStart/onSpeechEnd também respeitam o estado ativo", async () => {
    const engine = new MockWakeWordEngine();
    await engine.initialize(CONFIG);
    await engine.start();

    let inicio = 0;
    let fim = 0;
    engine.onSpeechStart(() => inicio++);
    engine.onSpeechEnd(() => fim++);
    engine.simularInicioDeFala();
    engine.simularFimDeFala();
    expect(inicio).toBe(1);
    expect(fim).toBe(1);
  });
});
