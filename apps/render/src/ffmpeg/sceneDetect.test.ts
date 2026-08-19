import { describe, expect, it } from "vitest";
import { montarArgsFfmpegSceneDetect, parseTimestampsDeCorteMs } from "./sceneDetect.js";

describe("montarArgsFfmpegSceneDetect", () => {
  it("usa o filtro scene com o threshold pedido e força saída null (sem escrever arquivo)", () => {
    const args = montarArgsFfmpegSceneDetect("/tmp/in.mp4", 0.4);
    expect(args).toContain("-vf");
    expect(args[args.indexOf("-vf") + 1]).toBe("select='gt(scene,0.4)',showinfo");
    expect(args[args.length - 1]).toBe("-");
  });

  it("usa 0.4 como threshold default", () => {
    const args = montarArgsFfmpegSceneDetect("/tmp/in.mp4");
    expect(args[args.indexOf("-vf") + 1]).toContain("0.4");
  });
});

describe("parseTimestampsDeCorteMs", () => {
  it("extrai todos os pts_time de um stderr real de showinfo", () => {
    const stderr = `
[Parsed_showinfo_1 @ 0x1] n:0 pts:0 pts_time:0.000000 duration:0.033
[Parsed_showinfo_1 @ 0x1] n:1 pts:2500 pts_time:2.500000 duration:0.033
[Parsed_showinfo_1 @ 0x1] n:2 pts:7810 pts_time:7.810000 duration:0.033
    `;
    expect(parseTimestampsDeCorteMs(stderr)).toEqual([0, 2500, 7810]);
  });

  it("devolve array vazio quando não há nenhuma linha showinfo (vídeo sem cortes detectados)", () => {
    expect(parseTimestampsDeCorteMs("frame=  100 fps=25 q=-1.0 Lsize=N/A time=00:00:04.00")).toEqual([]);
  });
});
