import { describe, expect, it } from "vitest";
import { montarArgsFfmpegProxy } from "./proxy.js";

describe("montarArgsFfmpegProxy", () => {
  it("monta os args com escala -2:altura (nunca distorce, largura sempre par)", () => {
    const args = montarArgsFfmpegProxy({ inputPath: "/tmp/in.mp4", outputPath: "/tmp/out.mp4" });
    expect(args).toContain("-i");
    expect(args[args.indexOf("-i") + 1]).toBe("/tmp/in.mp4");
    expect(args).toContain("-vf");
    expect(args[args.indexOf("-vf") + 1]).toBe("scale=-2:480");
    expect(args[args.length - 1]).toBe("/tmp/out.mp4");
  });

  it("usa a altura customizada quando informada", () => {
    const args = montarArgsFfmpegProxy({ inputPath: "a", outputPath: "b", alturaMaxima: 720 });
    expect(args[args.indexOf("-vf") + 1]).toBe("scale=-2:720");
  });

  it("sempre inclui -y (nunca trava esperando confirmação interativa)", () => {
    const args = montarArgsFfmpegProxy({ inputPath: "a", outputPath: "b" });
    expect(args[0]).toBe("-y");
  });

  it("usa libx264/aac com faststart (compatibilidade ampla + streaming progressivo)", () => {
    const args = montarArgsFfmpegProxy({ inputPath: "a", outputPath: "b" });
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args).toContain("+faststart");
  });
});
