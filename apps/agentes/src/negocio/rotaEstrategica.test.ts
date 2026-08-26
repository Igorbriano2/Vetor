import { describe, expect, it } from "vitest";
import { montarPerformanceLinhas, rotaEstrategicaValida } from "./rotaEstrategica.js";

describe("montarPerformanceLinhas", () => {
  it("classifica por custo/resultado relativo à média, nunca por limiar absoluto", () => {
    const linhas = montarPerformanceLinhas([
      { nome: "Barata", metricas: { spend: 100, compras: 20 } }, // R$5/resultado
      { nome: "Média", metricas: { spend: 100, compras: 5 } }, // R$20/resultado — média=25, 0.75x=18.75, 1.5x=37.5
      { nome: "Cara", metricas: { spend: 100, compras: 2 } }, // R$50/resultado
    ]);
    expect(linhas.find((l) => l.nome === "Barata")?.status).toBe("good");
    expect(linhas.find((l) => l.nome === "Média")?.status).toBe("warn");
    expect(linhas.find((l) => l.nome === "Cara")?.status).toBe("critical");
  });

  it("usa cliques como resultado quando não há compra, nunca inventa conversão", () => {
    const [linha] = montarPerformanceLinhas([{ nome: "Alcance", metricas: { spend: 50, clicks: 25, compras: 0 } }]);
    expect(linha.objetivo).toBe("Cliques");
    expect(linha.resultados).toBe("25");
  });

  it("nunca divide por zero — campanha sem resultado vira '—' e critical", () => {
    const [linha] = montarPerformanceLinhas([{ nome: "Sem resultado", metricas: { spend: 80, clicks: 0, compras: 0 } }]);
    expect(linha.custoResultado).toBe("—");
    expect(linha.status).toBe("critical");
  });

  it("devolve lista vazia sem quebrar quando não há campanhas", () => {
    expect(montarPerformanceLinhas([])).toEqual([]);
  });
});

describe("rotaEstrategicaValida", () => {
  const rotaCompleta = {
    titulo: "Plano de mídia",
    lede: "Objetivo do plano.",
    kpis: [{ label: "Teto diário", valor: "R$ 200" }],
    diagnostico: { resumo: "Diagnóstico real.", stats: [{ label: "Gasto", valor: "R$ 0" }] },
    estrategia: [{ kicker: "A", titulo: "Campanha", descricao: "...", investimentoSemana: "R$ 100" }],
    plano: [{ numero: 1, data: "Terça", fase: "Ativação", totalDia: "R$ 100", splitPorCampanha: [100], acoes: ["Publicar."] }],
    checklist: [{ titulo: "Pixel", descricao: "Confirmar antes de publicar." }],
    metricas: [{ nome: "CPC", contexto: "...", meta: "abaixo de R$ 5" }],
  };

  it("aceita uma rota com todos os blocos obrigatórios preenchidos", () => {
    expect(rotaEstrategicaValida(rotaCompleta)).toBe(true);
  });

  it("rejeita undefined/null", () => {
    expect(rotaEstrategicaValida(undefined)).toBe(false);
    expect(rotaEstrategicaValida(null)).toBe(false);
  });

  it("rejeita uma rota capenga (só título/lede, sem os blocos que dão sustância ao formato)", () => {
    expect(rotaEstrategicaValida({ titulo: "Plano", lede: "Resumo." })).toBe(false);
  });

  it("rejeita quando falta qualquer array obrigatório (ex: plano ausente)", () => {
    const { plano: _plano, ...semPlano } = rotaCompleta;
    expect(rotaEstrategicaValida(semPlano)).toBe(false);
  });
});
