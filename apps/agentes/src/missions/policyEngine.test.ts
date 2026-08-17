import { describe, it, expect } from "vitest";
import { avaliarRisco, precisaAprovacao, bloqueiaExecucaoAutomatica } from "./policyEngine.js";

describe("avaliarRisco", () => {
  it("classifica ferramentas conhecidas", () => {
    expect(avaliarRisco(["gerar_copy"])).toBe("low");
    expect(avaliarRisco(["publicar_conteudo_social"])).toBe("medium");
    expect(avaliarRisco(["pausar_campanha_trafego"])).toBe("medium");
  });

  it("ferramentas do gateway com riskLevel critical superam high", () => {
    expect(avaliarRisco(["ajustar_orcamento_trafego"])).toBe("critical");
    expect(avaliarRisco(["criar_audiencia"])).toBe("critical");
    expect(avaliarRisco(["gerar_copy", "ajustar_orcamento_trafego"])).toBe("critical");
  });

  it("usa o maior risco entre múltiplas ferramentas", () => {
    expect(avaliarRisco(["gerar_copy", "publicar_conteudo_social"])).toBe("medium");
  });

  it("falha fechado (critical) para ferramenta desconhecida", () => {
    expect(avaliarRisco(["ferramenta_nova_desconhecida"])).toBe("critical");
  });

  it("sem ferramentas é risco baixo", () => {
    expect(avaliarRisco([])).toBe("low");
  });
});

describe("precisaAprovacao", () => {
  it("low não precisa, medium/high/critical precisam", () => {
    expect(precisaAprovacao("low")).toBe(false);
    expect(precisaAprovacao("medium")).toBe(true);
    expect(precisaAprovacao("high")).toBe(true);
    expect(precisaAprovacao("critical")).toBe(true);
  });
});

describe("bloqueiaExecucaoAutomatica", () => {
  it("bloqueia qualquer ferramenta critical, não só orçamento de tráfego", () => {
    expect(bloqueiaExecucaoAutomatica("ajustar_orcamento_trafego")).toBe(true);
    expect(bloqueiaExecucaoAutomatica("criar_campanha_trafego")).toBe(true);
    expect(bloqueiaExecucaoAutomatica("enviar_mensagem_externa")).toBe(true);
    expect(bloqueiaExecucaoAutomatica("excluir_recurso")).toBe(true);
  });

  it("não bloqueia ferramentas de baixo/médio risco", () => {
    expect(bloqueiaExecucaoAutomatica("gerar_copy")).toBe(false);
    expect(bloqueiaExecucaoAutomatica("publicar_conteudo_social")).toBe(false);
  });

  it("ferramenta desconhecida bloqueia (fail-closed)", () => {
    expect(bloqueiaExecucaoAutomatica("ferramenta_nova_desconhecida")).toBe(true);
  });
});
