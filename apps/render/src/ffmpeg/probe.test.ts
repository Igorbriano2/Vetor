import { describe, expect, it } from "vitest";
import { montarArgsFfprobeDuracao } from "./probe.js";

describe("montarArgsFfprobeDuracao", () => {
  it("pede só a duração, sem cabeçalho/chave (saída pronta pra parseFloat)", () => {
    const args = montarArgsFfprobeDuracao("/tmp/in.mp4");
    expect(args).toContain("-show_entries");
    expect(args[args.indexOf("-show_entries") + 1]).toBe("format=duration");
    expect(args).toContain("default=noprint_wrappers=1:nokey=1");
    expect(args[args.length - 1]).toBe("/tmp/in.mp4");
  });
});
