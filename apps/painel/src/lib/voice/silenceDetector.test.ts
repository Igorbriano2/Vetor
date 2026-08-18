import { describe, expect, it } from "vitest";
import { calcularAmplitudeRms, DetectorDeSilencio } from "./silenceDetector";

describe("DetectorDeSilencio", () => {
  const CONFIG = { limiar: 0.05, silenceTimeoutMs: 1000, maxDurationMs: 10000 };

  it("não para enquanto a pessoa continua falando (amplitude acima do limiar)", () => {
    const detector = new DetectorDeSilencio(CONFIG);
    expect(detector.registrar(0.3, 0)).toBe(false);
    expect(detector.registrar(0.3, 500)).toBe(false);
    expect(detector.registrar(0.3, 2000)).toBe(false);
  });

  it("para depois de silenceTimeoutMs de silêncio contínuo", () => {
    const detector = new DetectorDeSilencio(CONFIG);
    detector.registrar(0.3, 0); // fala
    expect(detector.registrar(0.01, 100)).toBe(false); // silêncio começa
    expect(detector.registrar(0.01, 600)).toBe(false); // ainda dentro do timeout
    expect(detector.registrar(0.01, 1150)).toBe(true); // 1050ms de silêncio >= 1000ms
  });

  it("reseta a contagem de silêncio se a pessoa voltar a falar", () => {
    const detector = new DetectorDeSilencio(CONFIG);
    detector.registrar(0.3, 0);
    detector.registrar(0.01, 200); // silêncio começa
    detector.registrar(0.3, 800); // volta a falar antes de completar 1000ms — reseta
    expect(detector.registrar(0.01, 900)).toBe(false); // só 100ms de silêncio desde o reset
    expect(detector.registrar(0.01, 1950)).toBe(true); // agora sim, 1050ms depois do reset
  });

  it("para no teto absoluto mesmo sem nenhum silêncio (nunca grava pra sempre)", () => {
    const detector = new DetectorDeSilencio(CONFIG);
    detector.registrar(0.3, 0);
    expect(detector.registrar(0.3, 9999)).toBe(false);
    expect(detector.registrar(0.3, 10001)).toBe(true);
  });

  it("reiniciar() permite reusar o mesmo detector numa captura seguinte", () => {
    const detector = new DetectorDeSilencio(CONFIG);
    detector.registrar(0.01, 0);
    detector.registrar(0.01, 1500); // já pararia
    detector.reiniciar();
    expect(detector.registrar(0.3, 5000)).toBe(false); // conta do zero de novo
  });
});

describe("calcularAmplitudeRms", () => {
  it("devolve ~0 pra um buffer completamente silencioso (constante em 128)", () => {
    const silencio = new Uint8Array(64).fill(128);
    expect(calcularAmplitudeRms(silencio)).toBeCloseTo(0, 5);
  });

  it("devolve ~1 pra um buffer alternando entre os extremos (0 e 255)", () => {
    const bufferCheio = new Uint8Array(64);
    for (let i = 0; i < bufferCheio.length; i++) bufferCheio[i] = i % 2 === 0 ? 0 : 255;
    expect(calcularAmplitudeRms(bufferCheio)).toBeGreaterThan(0.9);
  });

  it("nunca quebra com buffer vazio", () => {
    expect(calcularAmplitudeRms(new Uint8Array(0))).toBe(0);
  });
});
