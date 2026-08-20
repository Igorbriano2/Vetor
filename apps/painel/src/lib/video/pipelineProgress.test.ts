import { describe, it, expect } from "vitest";
import { calcularProgresso } from "./pipelineProgress";

describe("calcularProgresso", () => {
  it("conta só os 5 estágios reais como concluídos", () => {
    const resultado = calcularProgresso([
      { stage: "proxy", status: "completed" },
      { stage: "timeline_draft", status: "completed" },
      { stage: "editorial_plan", status: "completed" }, // estágio schema-only, nunca conta
    ]);
    expect(resultado.concluidas).toBe(2);
    expect(resultado.total).toBe(5);
  });

  it("aponta a próxima etapa real pendente", () => {
    const resultado = calcularProgresso([
      { stage: "proxy", status: "completed" },
      { stage: "timeline_draft", status: "completed" },
    ]);
    expect(resultado.etapaAtual).toBe("captions");
  });

  it("etapaAtual null quando todas as 5 reais estão concluídas", () => {
    const resultado = calcularProgresso([
      { stage: "proxy", status: "completed" },
      { stage: "timeline_draft", status: "completed" },
      { stage: "captions", status: "completed" },
      { stage: "preview", status: "completed" },
      { stage: "final_render", status: "completed" },
    ]);
    expect(resultado.etapaAtual).toBeNull();
    expect(resultado.concluidas).toBe(5);
  });

  it("nenhum estágio ainda -> tudo pendente, começando pelo primeiro real", () => {
    const resultado = calcularProgresso([]);
    expect(resultado.concluidas).toBe(0);
    expect(resultado.etapaAtual).toBe("proxy");
  });
});
