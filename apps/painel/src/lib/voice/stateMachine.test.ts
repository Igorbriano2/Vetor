import { describe, expect, it } from "vitest";
import { podeTransicionar, transicionarVoz, TransicaoVozInvalidaError, VOICE_TRANSITIONS } from "./stateMachine";
import type { VoiceState } from "./types";

describe("stateMachine de voz", () => {
  it("percorre o caminho feliz completo de uma interação por voz", () => {
    const caminho: VoiceState[] = [
      "disabled",
      "permission_required",
      "requesting_permission",
      "standby",
      "wake_word_detected",
      "listening_request",
      "transcribing",
      "thinking",
      "speaking",
      "standby",
    ];
    for (let i = 1; i < caminho.length; i++) {
      expect(transicionarVoz(caminho[i - 1], caminho[i])).toBe(caminho[i]);
    }
  });

  it("nunca pula standby -> speaking direto (tem que passar por wake_word_detected e listening_request)", () => {
    expect(() => transicionarVoz("standby", "speaking")).toThrow(TransicaoVozInvalidaError);
  });

  it("\"disabled\" é alcançável de todo estado (usuário pode desligar a qualquer momento)", () => {
    for (const estado of Object.keys(VOICE_TRANSITIONS) as VoiceState[]) {
      if (estado === "disabled") continue;
      expect(podeTransicionar(estado, "disabled")).toBe(true);
    }
  });

  it("permission_denied permite tentar de novo ou desistir, nunca pula direto pra standby", () => {
    expect(podeTransicionar("permission_denied", "requesting_permission")).toBe(true);
    expect(podeTransicionar("permission_denied", "disabled")).toBe(true);
    expect(podeTransicionar("permission_denied", "standby")).toBe(false);
  });

  it("paused_by_browser volta pra standby ou detecta permissão revogada, nunca fala sozinho", () => {
    expect(podeTransicionar("paused_by_browser", "standby")).toBe(true);
    expect(podeTransicionar("paused_by_browser", "permission_denied")).toBe(true);
    expect(podeTransicionar("paused_by_browser", "speaking")).toBe(false);
  });

  it("unsupported só leva de volta pra disabled (nunca standby, nunca finge que funciona)", () => {
    expect(VOICE_TRANSITIONS.unsupported).toEqual(["disabled"]);
  });
});
