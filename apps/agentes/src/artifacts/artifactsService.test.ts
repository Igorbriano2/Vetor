import { describe, expect, it } from "vitest";
import { persistirArtefato, ArtefatoSemConteudoError } from "./artifactsService.js";

describe("persistirArtefato", () => {
  it("rejeita artefato sem conteúdo nem arquivo antes de tocar o banco", async () => {
    await expect(
      persistirArtefato({
        clienteId: "cli-1",
        type: "document",
        department: "design",
        title: "Briefing vazio",
        criadoPorAgente: "design",
      }),
    ).rejects.toBeInstanceOf(ArtefatoSemConteudoError);
  });
});
