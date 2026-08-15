import { describe, it, expect } from "vitest";
import { avaliarRisco, precisaAprovacao, bloqueiaExecucaoAutomatica } from "./policyEngine.js";

describe("avaliarRisco", () => {
  it("classifica ferramentas conhecidas", () => {
    expect(avaliarRisco(["gerar_copy"])).toBe("low");
    expect(avaliarRisco(["publicar_conteudo_social"])).toBe("medium");
    expect(avaliarRisco(["ajustar_orcamento_trafego"])).toBe("high");
  });

  it("usa o maior risco entre múltiplas ferramentas", () => {
    expect(avaliarRisco(["gerar_copy", "publicar_conteudo_social"])).toBe("medium");
    expect(avaliarRisco(["gerar_copy", "ajustar_orcamento_trafego"])).toBe("high");
  });

  it("falha fechado (high) para ferramenta desconhecida", () => {
    expect(avaliarRisco(["ferramenta_nova_desconhecida"])).toBe("high");
  });

  it("sem ferramentas é risco baixo", () => {
    expect(avaliarRisco([])).toBe("low");
  });
});

describe("precisaAprovacao", () => {
  it("low não precisa, medium/high precisam", () => {
    expect(precisaAprovacao("low")).toBe(false);
    expect(precisaAprovacao("medium")).toBe(true);
    expect(precisaAprovacao("high")).toBe(true);
  });
});

describe("bloqueiaExecucaoAutomatica", () => {
  it("bloqueia ajuste de orçamento de tráfego mesmo com aprovação", () => {
    expect(bloqueiaExecucaoAutomatica("ajustar_orcamento_trafego")).toBe(true);
  });

  it("não bloqueia outras ferramentas", () => {
    expect(bloqueiaExecucaoAutomatica("gerar_copy")).toBe(false);
  });
});
