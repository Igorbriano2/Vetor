import { describe, expect, it } from "vitest";
import { rotuloDoPlaceholder } from "./rotuloDePeca";

describe("rotuloDoPlaceholder", () => {
  it("nunca confunde falha com aguardando — status com 'fail' sempre vira 'Falhou na geração'", () => {
    expect(rotuloDoPlaceholder("failed", "image")).toBe("Falhou na geração");
    expect(rotuloDoPlaceholder("provider_failed", "video")).toBe("Falhou na geração");
  });

  it.each(["draft", "pending", "ready", "running", "processing", "awaiting_approval"])(
    "imagem/vídeo em status '%s' mostra 'Aguardando geração', nunca finge um preview que não existe",
    (status) => {
      expect(rotuloDoPlaceholder(status, "image")).toBe("Aguardando geração");
      expect(rotuloDoPlaceholder(status, "video")).toBe("Aguardando geração");
    },
  );

  it("tipos que nunca têm preview visual (copy/document/report/plan/campaign_snapshot) mostram o rótulo do tipo, nunca 'Aguardando geração'", () => {
    expect(rotuloDoPlaceholder("draft", "copy")).toBe("Copy");
    expect(rotuloDoPlaceholder("ready", "document")).toBe("Documento");
    expect(rotuloDoPlaceholder("completed", "report")).toBe("Relatório");
    expect(rotuloDoPlaceholder("completed", "plan")).toBe("Plano");
    expect(rotuloDoPlaceholder("completed", "campaign_snapshot")).toBe("Campanha");
  });

  it("imagem/vídeo concluídos sem url (caso real: upload falhou silenciosamente) caem pro rótulo do tipo, não 'Aguardando'", () => {
    expect(rotuloDoPlaceholder("completed", "image")).toBe("Imagem");
    expect(rotuloDoPlaceholder("completed", "video")).toBe("Vídeo");
  });

  it("tipo desconhecido nunca quebra — devolve o próprio valor bruto", () => {
    expect(rotuloDoPlaceholder("completed", "tipo-novo-nao-mapeado")).toBe("tipo-novo-nao-mapeado");
  });
});
