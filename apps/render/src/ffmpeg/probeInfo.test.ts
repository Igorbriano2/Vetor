import { describe, expect, it } from "vitest";
import { montarArgsFfprobeInfo, parseInfoFfprobe } from "./probeInfo.js";

describe("montarArgsFfprobeInfo", () => {
  it("pede width/height do primeiro stream de vídeo e a duração do formato, em json", () => {
    const args = montarArgsFfprobeInfo("/tmp/in.mp4");
    expect(args).toContain("-of");
    expect(args[args.indexOf("-of") + 1]).toBe("json");
    expect(args).toContain("stream=width,height:format=duration");
    expect(args[args.length - 1]).toBe("/tmp/in.mp4");
  });
});

describe("parseInfoFfprobe", () => {
  it("faz o parse de width/height/duration reais do json do ffprobe", () => {
    const json = JSON.stringify({ streams: [{ width: 1080, height: 1920 }], format: { duration: "35.067000" } });
    expect(parseInfoFfprobe(json)).toEqual({ durationMs: 35067, width: 1080, height: 1920 });
  });

  it("lança quando falta width/height (arquivo sem stream de vídeo)", () => {
    const json = JSON.stringify({ streams: [], format: { duration: "10.0" } });
    expect(() => parseInfoFfprobe(json)).toThrow();
  });
});
