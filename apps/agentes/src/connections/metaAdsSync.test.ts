import { describe, expect, it } from "vitest";
import { mapearStatus } from "./metaAdsSync.js";

describe("mapearStatus", () => {
  it("mapeia os status conhecidos da Graph API", () => {
    expect(mapearStatus("ACTIVE")).toBe("ativa");
    expect(mapearStatus("PAUSED")).toBe("pausada");
    expect(mapearStatus("ARCHIVED")).toBe("arquivada");
    expect(mapearStatus("DELETED")).toBe("arquivada");
  });

  it("cai em rascunho pra status desconhecido — fail-closed, nunca assume ativa", () => {
    expect(mapearStatus("QUALQUER_COISA_NOVA")).toBe("rascunho");
  });
});
