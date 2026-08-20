import { describe, expect, it } from "vitest";
import { traduzirStatusDePeca } from "./pecaStatus";

describe("traduzirStatusDePeca", () => {
  it("mapeia pending/ready pra Briefing recebido", () => {
    expect(traduzirStatusDePeca({ stepStatus: "pending", missaoStatus: "running" })).toBe("Briefing recebido");
    expect(traduzirStatusDePeca({ stepStatus: "ready", missaoStatus: "running" })).toBe("Briefing recebido");
  });

  it("mapeia awaiting_approval pra Aguardando sua aprovação", () => {
    expect(traduzirStatusDePeca({ stepStatus: "awaiting_approval", missaoStatus: "running" })).toBe(
      "Aguardando sua aprovação",
    );
  });

  it("mapeia design_project approved + missão não terminal pra Aprovada", () => {
    expect(
      traduzirStatusDePeca({ stepStatus: "completed", missaoStatus: "running", designProjectStatus: "approved" }),
    ).toBe("Aprovada");
  });

  it("mapeia design_project approved + missão terminal pra Entregue", () => {
    expect(
      traduzirStatusDePeca({ stepStatus: "completed", missaoStatus: "completed", designProjectStatus: "approved" }),
    ).toBe("Entregue");
  });

  it("mapeia completed + draft + version>1 pra Em edição (sinal real de edição salva)", () => {
    expect(
      traduzirStatusDePeca({
        stepStatus: "completed",
        missaoStatus: "running",
        designProjectStatus: "draft",
        designProjectVersion: 2,
      }),
    ).toBe("Em edição");
  });

  it("mapeia completed + draft + version=1 pra Pronta para aprovação", () => {
    expect(
      traduzirStatusDePeca({
        stepStatus: "completed",
        missaoStatus: "running",
        designProjectStatus: "draft",
        designProjectVersion: 1,
      }),
    ).toBe("Pronta para aprovação");
  });

  it("mapeia failed + imagemIndisponivel pro status de fallback de provedor", () => {
    expect(
      traduzirStatusDePeca({ stepStatus: "failed", missaoStatus: "running", imagemIndisponivel: true }),
    ).toBe("Provedor de imagem indisponível — briefing pronto");
  });

  it("nunca mostra o status de provedor indisponível pra uma falha comum (sem o sinal real)", () => {
    expect(traduzirStatusDePeca({ stepStatus: "failed", missaoStatus: "running" })).toBeNull();
    expect(
      traduzirStatusDePeca({ stepStatus: "failed", missaoStatus: "running", imagemIndisponivel: false }),
    ).toBeNull();
  });

  it("retorna null pra status técnicos que o vocabulário não cobre (blocked/cancelled/skipped)", () => {
    expect(traduzirStatusDePeca({ stepStatus: "blocked", missaoStatus: "running" })).toBeNull();
    expect(traduzirStatusDePeca({ stepStatus: "cancelled", missaoStatus: "running" })).toBeNull();
    expect(traduzirStatusDePeca({ stepStatus: "skipped", missaoStatus: "running" })).toBeNull();
  });
});
