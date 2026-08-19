import { describe, expect, it, vi } from "vitest";
import { executarComFallback, TodosOsProvedoresFalharamError, type ProvedorRegistrado } from "./router.js";

describe("executarComFallback", () => {
  it("usa o primeiro provedor disponível quando ele funciona", async () => {
    const primeiro: ProvedorRegistrado<string, string> = {
      nome: "primeiro",
      disponivel: () => true,
      executar: vi.fn().mockResolvedValue("resultado-primeiro"),
    };
    const segundo: ProvedorRegistrado<string, string> = {
      nome: "segundo",
      disponivel: () => true,
      executar: vi.fn().mockResolvedValue("resultado-segundo"),
    };

    const resultado = await executarComFallback([primeiro, segundo], "entrada");

    expect(resultado.resultado).toBe("resultado-primeiro");
    expect(resultado.provedorUsado).toBe("primeiro");
    expect(resultado.tentativas).toEqual([]);
    expect(segundo.executar).not.toHaveBeenCalled();
  });

  it("pula provedor indisponível sem tentar executar", async () => {
    const indisponivel: ProvedorRegistrado<string, string> = {
      nome: "indisponivel",
      disponivel: () => false,
      executar: vi.fn(),
    };
    const disponivel: ProvedorRegistrado<string, string> = {
      nome: "disponivel",
      disponivel: () => true,
      executar: vi.fn().mockResolvedValue("ok"),
    };

    const resultado = await executarComFallback([indisponivel, disponivel], "x");

    expect(resultado.provedorUsado).toBe("disponivel");
    expect(indisponivel.executar).not.toHaveBeenCalled();
    expect(resultado.tentativas).toEqual([{ provedor: "indisponivel", erro: "indisponível (não configurado)" }]);
  });

  it("cai pro próximo provedor quando o primeiro falha na execução real", async () => {
    const falha: ProvedorRegistrado<string, string> = {
      nome: "falha",
      disponivel: () => true,
      executar: vi.fn().mockRejectedValue(new Error("API fora do ar")),
    };
    const sucesso: ProvedorRegistrado<string, string> = {
      nome: "sucesso",
      disponivel: () => true,
      executar: vi.fn().mockResolvedValue("recuperado"),
    };

    const resultado = await executarComFallback([falha, sucesso], "x");

    expect(resultado.resultado).toBe("recuperado");
    expect(resultado.provedorUsado).toBe("sucesso");
    expect(resultado.tentativas).toEqual([{ provedor: "falha", erro: "API fora do ar" }]);
  });

  it("lança TodosOsProvedoresFalharamError com todas as tentativas quando nada funciona", async () => {
    const a: ProvedorRegistrado<string, string> = { nome: "a", disponivel: () => false, executar: vi.fn() };
    const b: ProvedorRegistrado<string, string> = {
      nome: "b",
      disponivel: () => true,
      executar: vi.fn().mockRejectedValue(new Error("500")),
    };

    const promessa = executarComFallback([a, b], "x");
    await expect(promessa).rejects.toBeInstanceOf(TodosOsProvedoresFalharamError);
    await expect(promessa).rejects.toMatchObject({
      tentativas: [
        { provedor: "a", erro: "indisponível (não configurado)" },
        { provedor: "b", erro: "500" },
      ],
    });
  });

  it("lança TodosOsProvedoresFalharamError com lista vazia quando não há nenhum provedor", async () => {
    await expect(executarComFallback([], "x")).rejects.toBeInstanceOf(TodosOsProvedoresFalharamError);
  });
});
