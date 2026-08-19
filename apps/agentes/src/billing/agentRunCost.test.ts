import { describe, expect, it } from "vitest";
import { calcularCustoEstimadoCentavos } from "./agentRunCost.js";

describe("calcularCustoEstimadoCentavos", () => {
  it("calcula custo real a partir de tokens reais (claude-sonnet-4-5)", () => {
    // 1M tokens de entrada ($3) + 1M de saída ($15) = $18 * R$5,40 (câmbio fixo
    // do teste, não o default do ambiente) = R$97,20 = 9720 centavos
    const resultado = calcularCustoEstimadoCentavos({
      modelo: "claude-sonnet-4-5",
      tokensEntrada: 1_000_000,
      tokensSaida: 1_000_000,
      cambioUsdBrlCentavos: 540,
    });
    expect(resultado.motivoAusencia).toBeNull();
    expect(resultado.custoEstimadoCentavos).toBe(9720);
  });

  it("arredonda pra centavo mais próximo (nunca fração de centavo)", () => {
    const resultado = calcularCustoEstimadoCentavos({
      modelo: "claude-sonnet-4-5",
      tokensEntrada: 123,
      tokensSaida: 45,
      cambioUsdBrlCentavos: 540,
    });
    expect(resultado.custoEstimadoCentavos).not.toBeNull();
    expect(Number.isInteger(resultado.custoEstimadoCentavos)).toBe(true);
  });

  it("respeita um câmbio diferente do default quando injetado (moeda é parâmetro, não fixo)", () => {
    const resultado = calcularCustoEstimadoCentavos({
      modelo: "claude-sonnet-4-5",
      tokensEntrada: 1_000_000,
      tokensSaida: 0,
      cambioUsdBrlCentavos: 100, // R$1,00 por dólar, só pro teste
    });
    // 1M tokens de entrada * $3/M = $3 * R$1,00 = 300 centavos
    expect(resultado.custoEstimadoCentavos).toBe(300);
  });

  it("nunca inventa custo quando não há usage — devolve null + motivo", () => {
    const semTokens = calcularCustoEstimadoCentavos({ modelo: "claude-sonnet-4-5", tokensEntrada: null, tokensSaida: null });
    expect(semTokens.custoEstimadoCentavos).toBeNull();
    expect(semTokens.motivoAusencia).toMatch(/usage/i);

    const semModelo = calcularCustoEstimadoCentavos({ modelo: undefined, tokensEntrada: 100, tokensSaida: 50 });
    expect(semModelo.custoEstimadoCentavos).toBeNull();
    expect(semModelo.motivoAusencia).toMatch(/modelo/i);
  });

  it("nunca inventa custo pra modelo fora da tabela de preços conhecida", () => {
    const resultado = calcularCustoEstimadoCentavos({
      modelo: "modelo-desconhecido-do-futuro",
      tokensEntrada: 100,
      tokensSaida: 50,
    });
    expect(resultado.custoEstimadoCentavos).toBeNull();
    expect(resultado.motivoAusencia).toMatch(/não está na tabela de preços/);
  });

  it("nunca inventa custo com usage inválido (negativo/NaN)", () => {
    const negativo = calcularCustoEstimadoCentavos({ modelo: "claude-sonnet-4-5", tokensEntrada: -5, tokensSaida: 10 });
    expect(negativo.custoEstimadoCentavos).toBeNull();
    expect(negativo.motivoAusencia).toMatch(/inválido/);

    const naoFinito = calcularCustoEstimadoCentavos({ modelo: "claude-sonnet-4-5", tokensEntrada: NaN, tokensSaida: 10 });
    expect(naoFinito.custoEstimadoCentavos).toBeNull();
    expect(naoFinito.motivoAusencia).toMatch(/inválido/);
  });
});
