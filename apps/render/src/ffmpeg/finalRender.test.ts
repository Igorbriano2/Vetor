import { describe, expect, it } from "vitest";
import { montarArgsFfmpegRenderFinal } from "./finalRender.js";

describe("montarArgsFfmpegRenderFinal", () => {
  it("aplica trim (corte simples) via -ss/-t a partir do input original", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/original.mp4",
      outputPath: "/tmp/final.mp4",
      trimInMs: 1500,
      trimOutMs: 5500,
    });
    expect(args.slice(0, 3)).toEqual(["-y", "-i", "/tmp/original.mp4"]);
    expect(args[args.indexOf("-ss") + 1]).toBe("1.500");
    // duração = trimOut - trimIn = 4000ms = 4.000s
    expect(args[args.indexOf("-t") + 1]).toBe("4.000");
    expect(args[args.length - 1]).toBe("/tmp/final.mp4");
  });

  it("sem legendas, nunca inclui o filtro subtitles", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
    });
    expect(args).not.toContain("-vf");
  });

  it("com legendas, aplica o filtro subtitles com o caminho do .srt", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
      legendasSrtPath: "/tmp/legendas.srt",
    });
    expect(args).toContain("-vf");
    expect(args[args.indexOf("-vf") + 1]).toBe("subtitles=/tmp/legendas.srt");
  });

  it("escapa ':' no caminho do .srt (sintaxe do filtro subtitles usa ':' como separador de opção)", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
      legendasSrtPath: "C:\\pasta\\legendas.srt",
    });
    expect(args[args.indexOf("-vf") + 1]).toBe("subtitles=C\\:\\\\pasta\\\\legendas.srt");
  });

  it("sempre reencoda em libx264/aac com faststart (entregável final, nunca stream-copy)", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
    });
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args).toContain("+faststart");
  });
});
