import { describe, expect, it } from "vitest";
import { classificarStatusStep } from "./statusProgresso";

describe("classificarStatusStep", () => {
  it("classifica etapas ainda rodando como em produção", () => {
    expect(classificarStatusStep("pending")).toBe("em_producao");
    expect(classificarStatusStep("ready")).toBe("em_producao");
    expect(classificarStatusStep("running")).toBe("em_producao");
    expect(classificarStatusStep("awaiting_approval")).toBe("em_producao");
  });

  it("classifica etapas travadas como com falha", () => {
    expect(classificarStatusStep("failed")).toBe("com_falha");
    expect(classificarStatusStep("blocked")).toBe("com_falha");
  });

  it("não classifica etapas concluídas ou puladas (já viram artefato ou não importam pra galeria)", () => {
    expect(classificarStatusStep("completed")).toBeNull();
    expect(classificarStatusStep("skipped")).toBeNull();
    expect(classificarStatusStep("cancelled")).toBeNull();
  });
});
