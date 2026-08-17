import { describe, it, expect } from "vitest";
import {
  transicionarMissao,
  transicionarEtapa,
  transicionarSolicitacao,
  TransicaoInvalidaError,
  MISSION_TRANSITIONS,
  STEP_TRANSITIONS,
  SOLICITACAO_TRANSITIONS,
} from "./stateMachine.js";

describe("transicionarMissao", () => {
  it("permite o caminho feliz completo", () => {
    expect(transicionarMissao("draft", "understanding")).toBe("understanding");
    expect(transicionarMissao("understanding", "planned")).toBe("planned");
    expect(transicionarMissao("planned", "queued")).toBe("queued");
    expect(transicionarMissao("queued", "running")).toBe("running");
    expect(transicionarMissao("running", "completed")).toBe("completed");
    expect(transicionarMissao("completed", "archived")).toBe("archived");
  });

  it("permite o caminho de aprovação", () => {
    expect(transicionarMissao("planned", "awaiting_approval")).toBe("awaiting_approval");
    expect(transicionarMissao("awaiting_approval", "queued")).toBe("queued");
  });

  it("rejeita pular etapas", () => {
    expect(() => transicionarMissao("draft", "completed")).toThrow(TransicaoInvalidaError);
    expect(() => transicionarMissao("draft", "running")).toThrow(TransicaoInvalidaError);
  });

  it("estado terminal archived não tem saída", () => {
    expect(MISSION_TRANSITIONS.archived).toEqual([]);
  });

  it("cancelled é possível a partir de quase todo estado não-terminal", () => {
    expect(transicionarMissao("draft", "cancelled")).toBe("cancelled");
    expect(transicionarMissao("understanding", "cancelled")).toBe("cancelled");
    expect(transicionarMissao("queued", "cancelled")).toBe("cancelled");
  });
});

describe("transicionarEtapa", () => {
  it("permite o caminho feliz", () => {
    expect(transicionarEtapa("pending", "ready")).toBe("ready");
    expect(transicionarEtapa("ready", "running")).toBe("running");
    expect(transicionarEtapa("running", "completed")).toBe("completed");
  });

  it("permite fluxo de aprovação e retomada", () => {
    expect(transicionarEtapa("running", "awaiting_approval")).toBe("awaiting_approval");
    expect(transicionarEtapa("awaiting_approval", "ready")).toBe("ready");
  });

  it("rejeita transição inválida", () => {
    expect(() => transicionarEtapa("completed", "running")).toThrow(TransicaoInvalidaError);
    expect(() => transicionarEtapa("pending", "completed")).toThrow(TransicaoInvalidaError);
  });

  it("estados terminais completed/skipped/cancelled não têm saída", () => {
    expect(STEP_TRANSITIONS.completed).toEqual([]);
    expect(STEP_TRANSITIONS.skipped).toEqual([]);
    expect(STEP_TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("transicionarMissao — estados novos (Fase 5)", () => {
  it("running pode ir para quality_review ou awaiting_evidence", () => {
    expect(transicionarMissao("running", "quality_review")).toBe("quality_review");
    expect(transicionarMissao("running", "awaiting_evidence")).toBe("awaiting_evidence");
  });

  it("quality_review resolve em completed, completed_with_caveats ou replanning", () => {
    expect(transicionarMissao("quality_review", "completed")).toBe("completed");
    expect(transicionarMissao("quality_review", "completed_with_caveats")).toBe("completed_with_caveats");
    expect(transicionarMissao("quality_review", "replanning")).toBe("replanning");
  });

  it("replanning só sai para planned ou cancelled — nunca direto pra completed", () => {
    expect(transicionarMissao("replanning", "planned")).toBe("planned");
    expect(() => transicionarMissao("replanning", "completed")).toThrow(TransicaoInvalidaError);
  });

  it("blocked e failed podem entrar em replanning", () => {
    expect(transicionarMissao("blocked", "replanning")).toBe("replanning");
    expect(transicionarMissao("failed", "replanning")).toBe("replanning");
  });

  it("completed_with_caveats é terminal (só vai pra archived)", () => {
    expect(MISSION_TRANSITIONS.completed_with_caveats).toEqual(["archived"]);
  });

  it("awaiting_evidence não pula direto pra completed", () => {
    expect(() => transicionarMissao("awaiting_evidence", "completed")).toThrow(TransicaoInvalidaError);
    expect(transicionarMissao("awaiting_evidence", "running")).toBe("running");
  });
});

describe("transicionarSolicitacao", () => {
  it("caminho feliz por texto (sem transcrição)", () => {
    expect(transicionarSolicitacao("received", "understanding")).toBe("understanding");
    expect(transicionarSolicitacao("understanding", "planned")).toBe("planned");
    expect(transicionarSolicitacao("planned", "confirmed")).toBe("confirmed");
    expect(transicionarSolicitacao("confirmed", "converted_to_mission")).toBe("converted_to_mission");
  });

  it("caminho por áudio passa por transcribing", () => {
    expect(transicionarSolicitacao("received", "transcribing")).toBe("transcribing");
    expect(transicionarSolicitacao("transcribing", "understanding")).toBe("understanding");
  });

  it("contexto insuficiente vai pra awaiting_context e pode voltar", () => {
    expect(transicionarSolicitacao("understanding", "awaiting_context")).toBe("awaiting_context");
    expect(transicionarSolicitacao("awaiting_context", "understanding")).toBe("understanding");
  });

  it("rejeita pular de received direto pra confirmed", () => {
    expect(() => transicionarSolicitacao("received", "confirmed")).toThrow(TransicaoInvalidaError);
  });

  it("converted_to_mission e archived são terminais (exceto archived como saída)", () => {
    expect(SOLICITACAO_TRANSITIONS.converted_to_mission).toEqual(["archived"]);
    expect(SOLICITACAO_TRANSITIONS.archived).toEqual([]);
  });
});
