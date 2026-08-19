import { describe, expect, it } from "vitest";
import { calcularAspectRatio, calcularMetricasDeCorte, classificarEnergiaMusical } from "./referenceVideoAnalysis.js";

describe("calcularMetricasDeCorte", () => {
  it("calcula densidade de corte e duração média de plano a partir de timestamps reais", () => {
    // 3 cortes em 60s de vídeo -> 3 cortes/min, 4 planos de 15s cada.
    const metricas = calcularMetricasDeCorte([15000, 30000, 45000], 60000);
    expect(metricas.cutDensityPerMinute).toBe(3);
    expect(metricas.averageShotDurationMs).toBe(15000);
    expect(metricas.pacing).toBe("slow");
  });

  it("classifica pacing fast quando a densidade de corte é alta", () => {
    const cuts = Array.from({ length: 30 }, (_, i) => (i + 1) * 2000); // 30 cortes em 60s = 30 cortes/min
    const metricas = calcularMetricasDeCorte(cuts, 60000);
    expect(metricas.pacing).toBe("fast");
  });

  it("classifica pacing medium na faixa intermediária", () => {
    const cuts = Array.from({ length: 12 }, (_, i) => (i + 1) * 5000); // 12 cortes em 60s = 12 cortes/min
    const metricas = calcularMetricasDeCorte(cuts, 60000);
    expect(metricas.pacing).toBe("medium");
  });

  it("vídeo sem nenhum corte detectado vira um único plano com a duração inteira", () => {
    const metricas = calcularMetricasDeCorte([], 10000);
    expect(metricas.cutDensityPerMinute).toBe(0);
    expect(metricas.averageShotDurationMs).toBe(10000);
    expect(metricas.pacing).toBe("slow");
  });

  it("lança com durationMs inválido", () => {
    expect(() => calcularMetricasDeCorte([], 0)).toThrow();
  });
});

describe("classificarEnergiaMusical", () => {
  it("classifica high pra volume médio alto", () => {
    expect(classificarEnergiaMusical(-10)).toBe("high");
  });

  it("classifica medium pra volume médio moderado", () => {
    expect(classificarEnergiaMusical(-18)).toBe("medium");
  });

  it("classifica low pra volume médio baixo", () => {
    expect(classificarEnergiaMusical(-30)).toBe("low");
  });

  it("usa medium como fallback neutro quando não há trilha de áudio (null)", () => {
    expect(classificarEnergiaMusical(null)).toBe("medium");
  });
});

describe("calcularAspectRatio", () => {
  it("reduz 1080x1920 pra 9:16", () => {
    expect(calcularAspectRatio(1080, 1920)).toBe("9:16");
  });

  it("reduz 1080x1080 pra 1:1", () => {
    expect(calcularAspectRatio(1080, 1080)).toBe("1:1");
  });

  it("reduz 1920x1080 pra 16:9", () => {
    expect(calcularAspectRatio(1920, 1080)).toBe("16:9");
  });

  it("lança com dimensão inválida", () => {
    expect(() => calcularAspectRatio(0, 100)).toThrow();
  });
});
