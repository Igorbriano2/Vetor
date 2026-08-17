import { describe, expect, it } from "vitest";
import { calcularHashPlano, type PlanoConfirmado } from "./orchestrator.js";

// Só testa calcularHashPlano — é a única função pura de orchestrator.ts
// (o resto depende do client Supabase encadeado, mocká-lo é um esforço à
// parte, ver relatório final). Cobre exatamente a garantia que a Fase 4
// promete: o hash prova que a missão nasceu do plano que o humano confirmou,
// não de uma versão reordenada/alterada.

const planoBase: PlanoConfirmado = {
  titulo: "Aumentar pedidos de delivery",
  objetivo: "Crescer pedidos de delivery em 4 semanas sem passar de R$ 1.500 em mídia",
  hipotese: "Promoção de horário de baixo movimento aumenta ticket",
  criterioSucesso: ["+15% pedidos", "CAC estável"],
  etapas: [
    {
      chave: "design-1",
      agente: "design",
      tarefa: "Criar peça promocional",
      dependeDe: [],
      ferramentas: ["gerar_design"],
    },
    {
      chave: "trafego-1",
      agente: "trafego",
      tarefa: "Planejar campanha",
      dependeDe: ["design-1"],
      ferramentas: ["criar_briefing"],
    },
  ],
};

describe("calcularHashPlano", () => {
  it("é determinístico para o mesmo plano", () => {
    expect(calcularHashPlano(planoBase)).toBe(calcularHashPlano(planoBase));
  });

  it("ignora a ordem das etapas, das ferramentas e do critério de sucesso", () => {
    const reordenado: PlanoConfirmado = {
      ...planoBase,
      criterioSucesso: [...planoBase.criterioSucesso].reverse(),
      etapas: [...planoBase.etapas].reverse().map((e) => ({ ...e, ferramentas: [...e.ferramentas].reverse() })),
    };
    expect(calcularHashPlano(reordenado)).toBe(calcularHashPlano(planoBase));
  });

  it("muda se o objetivo mudar", () => {
    const alterado: PlanoConfirmado = { ...planoBase, objetivo: "Outro objetivo qualquer" };
    expect(calcularHashPlano(alterado)).not.toBe(calcularHashPlano(planoBase));
  });

  it("muda se uma etapa ganhar uma ferramenta a mais (mudança de risco)", () => {
    const alterado: PlanoConfirmado = {
      ...planoBase,
      etapas: planoBase.etapas.map((e) =>
        e.chave === "trafego-1" ? { ...e, ferramentas: [...e.ferramentas, "ajustar_orcamento_trafego"] } : e,
      ),
    };
    expect(calcularHashPlano(alterado)).not.toBe(calcularHashPlano(planoBase));
  });

  it("trata hipótese ausente e hipótese undefined da mesma forma", () => {
    const semHipotese: PlanoConfirmado = { ...planoBase, hipotese: undefined };
    const { hipotese: _hipotese, ...semCampoHipotese } = planoBase;
    expect(calcularHashPlano(semHipotese)).toBe(calcularHashPlano(semCampoHipotese as PlanoConfirmado));
  });
});
