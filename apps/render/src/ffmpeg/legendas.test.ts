import { describe, expect, it } from "vitest";
import { montarSrtDeLegendas } from "./legendas.js";

describe("montarSrtDeLegendas", () => {
  it("formata um cue simples no formato SRT padrão (HH:MM:SS,mmm)", () => {
    const srt = montarSrtDeLegendas([{ startMs: 1500, endMs: 3200, text: "Olá mundo" }]);
    expect(srt).toBe("1\n00:00:01,500 --> 00:00:03,200\nOlá mundo\n");
  });

  it("numera múltiplos cues em sequência, na ordem recebida", () => {
    const srt = montarSrtDeLegendas([
      { startMs: 0, endMs: 1000, text: "Primeiro" },
      { startMs: 1000, endMs: 2000, text: "Segundo" },
    ]);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:01,000\nPrimeiro\n");
    expect(srt).toContain("2\n00:00:01,000 --> 00:00:02,000\nSegundo\n");
  });

  it("lida com horas reais (>=1h de vídeo)", () => {
    const srt = montarSrtDeLegendas([{ startMs: 3_661_250, endMs: 3_662_000, text: "Uma hora e um pouco" }]);
    expect(srt).toContain("01:01:01,250 --> 01:01:02,000");
  });

  it("array vazio devolve string vazia (nenhuma legenda real, nunca inventa uma)", () => {
    expect(montarSrtDeLegendas([])).toBe("");
  });
});
