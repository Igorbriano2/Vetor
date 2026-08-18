import { describe, expect, it } from "vitest";
import { passouCooldown } from "./cooldown";

describe("passouCooldown", () => {
  it("bloqueia uma segunda detecção logo em seguida da primeira (falso positivo típico: mesma palavra em dois resultados intermediários)", () => {
    expect(passouCooldown(1000, 1200, 2500)).toBe(false);
  });

  it("libera depois do cooldown completo", () => {
    expect(passouCooldown(1000, 3600, 2500)).toBe(true);
  });

  it("é exclusivo na borda exata do cooldown", () => {
    expect(passouCooldown(1000, 3500, 2500)).toBe(true);
    expect(passouCooldown(1000, 3499, 2500)).toBe(false);
  });
});
