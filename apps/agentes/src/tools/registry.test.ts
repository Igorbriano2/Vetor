import { describe, it, expect } from "vitest";
import { buscarFerramenta, validarChamadaFerramenta, TOOL_REGISTRY } from "./registry.js";

describe("buscarFerramenta", () => {
  it("retorna a definição registrada", () => {
    expect(buscarFerramenta("ler_perfil_negocio").riskLevel).toBe("low");
    expect(buscarFerramenta("ajustar_orcamento_trafego").riskLevel).toBe("critical");
  });

  it("ferramenta desconhecida vira crítica, fail-closed", () => {
    const def = buscarFerramenta("nao_existe");
    expect(def.riskLevel).toBe("critical");
    expect(def.reversible).toBe(false);
    expect(def.allowedRoles).toEqual([]);
  });
});

describe("validarChamadaFerramenta", () => {
  const contexto = { papel: "cliente", clienteId: "cli-1" };

  it("permite ferramenta de baixo risco com campos obrigatórios presentes", () => {
    const resultado = validarChamadaFerramenta("criar_briefing", { titulo: "x", objetivo: "y" }, contexto);
    expect(resultado.permitido).toBe(true);
  });

  it("rejeita quando falta campo obrigatório", () => {
    const resultado = validarChamadaFerramenta("criar_briefing", { titulo: "x" }, contexto);
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toMatch(/objetivo/);
  });

  it("rejeita ferramenta não registrada", () => {
    const resultado = validarChamadaFerramenta("apagar_tudo_do_cliente", {}, contexto);
    expect(resultado.permitido).toBe(false);
  });

  it("rejeita papel sem permissão pra ferramenta crítica sem allowedRoles", () => {
    const resultado = validarChamadaFerramenta("nao_existe_tambem", {}, contexto);
    expect(resultado.permitido).toBe(false);
  });

  it("todo tool do registro tem riskLevel e requiresApproval coerentes", () => {
    for (const def of Object.values(TOOL_REGISTRY)) {
      if (def.riskLevel === "low") {
        expect(def.requiresApproval).toBe(false);
      } else {
        expect(def.requiresApproval).toBe(true);
      }
    }
  });

  // Critério 7 da Fase 10 (docs/DESIGN-V2-PHASE-9-10-REPORT.md) — aprovação
  // é exigida antes de QUALQUER chamada paga. As três ferramentas que
  // realmente gastam crédito de geração (imagem ou vídeo) nunca podem virar
  // "low" por acidente numa mudança futura — isso destravaria execução
  // automática sem aprovação (ver avaliarRisco em policyEngine.ts, que usa
  // exatamente riskLevel pra decidir se a etapa nasce aguardando aprovação).
  it.each(["criar_peca_de_design", "gerar_imagem", "gerar_video_higgsfield"])(
    "'%s' gasta crédito real de geração — permanece medium+ (nunca low, nunca sem aprovação)",
    (nome) => {
      const def = buscarFerramenta(nome);
      expect(["medium", "high", "critical"]).toContain(def.riskLevel);
      expect(def.requiresApproval).toBe(true);
    },
  );
});
