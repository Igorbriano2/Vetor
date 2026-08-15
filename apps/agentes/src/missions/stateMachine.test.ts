import { describe, it, expect } from "vitest";
import {
  transicionarMissao,
  transicionarEtapa,
  TransicaoInvalidaError,
  MISSION_TRANSITIONS,
  STEP_TRANSITIONS,
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
