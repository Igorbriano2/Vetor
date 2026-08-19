import { describe, expect, it } from "vitest";
import { montarArgsFfmpegVolumeDetect, parseMeanVolumeDb } from "./audioVolume.js";

describe("montarArgsFfmpegVolumeDetect", () => {
  it("aplica o filtro volumedetect e não escreve arquivo de saída", () => {
    const args = montarArgsFfmpegVolumeDetect("/tmp/in.mp4");
    expect(args).toContain("-af");
    expect(args[args.indexOf("-af") + 1]).toBe("volumedetect");
    expect(args[args.length - 1]).toBe("-");
  });
});

describe("parseMeanVolumeDb", () => {
  it("extrai o mean_volume real de um stderr de volumedetect", () => {
    const stderr = `
[Parsed_volumedetect_0 @ 0x1] n_samples: 176400
[Parsed_volumedetect_0 @ 0x1] mean_volume: -18.3 dB
[Parsed_volumedetect_0 @ 0x1] max_volume: -2.1 dB
    `;
    expect(parseMeanVolumeDb(stderr)).toBe(-18.3);
  });

  it("devolve null quando o arquivo não tem trilha de áudio", () => {
    expect(parseMeanVolumeDb("Stream #0:0: Video: h264")).toBeNull();
  });
});
