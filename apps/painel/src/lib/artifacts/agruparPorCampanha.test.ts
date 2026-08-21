import { describe, it, expect } from "vitest";
import { agruparPorCampanha } from "./agruparPorCampanha";
import type { ArtefatoBiblioteca } from "./fetchArtifacts";

function artefato(over: Partial<ArtefatoBiblioteca> = {}): ArtefatoBiblioteca {
  return {
    id: "a1",
    type: "document",
    title: "t",
    description: null,
    status: "ready",
    department: "design",
    missionId: "m1",
    missionTitulo: "Campanha X",
    url: null,
    content: null,
    createdAt: "2026-01-01T00:00:00Z",
    designProjectId: null,
    ...over,
  };
}

describe("agruparPorCampanha", () => {
  it("agrupa artefatos da mesma missão numa única campanha", () => {
    const resultado = agruparPorCampanha(
      [artefato({ id: "a1" }), artefato({ id: "a2" })],
      [{ id: "m1", objetivo: "Vender mais", status: "running", createdAt: "2026-01-01T00:00:00Z" }],
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0].artefatos).toHaveLength(2);
    expect(resultado[0].objetivo).toBe("Vender mais");
  });

  it("coloca artefatos sem missionId numa campanha 'Sem campanha' separada", () => {
    const resultado = agruparPorCampanha([artefato({ id: "a1", missionId: null, missionTitulo: null })], []);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].titulo).toBe("Sem campanha");
  });

  it("escolhe a capa como o primeiro artefato visual (image/video) com url real", () => {
    const resultado = agruparPorCampanha(
      [
        artefato({ id: "a1", type: "document" }),
        artefato({ id: "a2", type: "image", url: "https://exemplo/img.png" }),
      ],
      [{ id: "m1", objetivo: null, status: null, createdAt: "2026-01-01T00:00:00Z" }],
    );
    expect(resultado[0].capaUrl).toBe("https://exemplo/img.png");
  });

  it("nunca escolhe capa de um artefato de imagem sem url real (nunca inventa preview)", () => {
    const resultado = agruparPorCampanha(
      [artefato({ id: "a1", type: "image", url: null })],
      [{ id: "m1", objetivo: null, status: null, createdAt: "2026-01-01T00:00:00Z" }],
    );
    expect(resultado[0].capaUrl).toBeNull();
  });

  it("ordena artefatos visuais (image/video) antes de documentos dentro da campanha", () => {
    const resultado = agruparPorCampanha(
      [
        artefato({ id: "doc", type: "document" }),
        artefato({ id: "copy", type: "copy" }),
        artefato({ id: "img", type: "image" }),
      ],
      [{ id: "m1", objetivo: null, status: null, createdAt: "2026-01-01T00:00:00Z" }],
    );
    expect(resultado[0].artefatos.map((a) => a.id)).toEqual(["img", "doc", "copy"]);
  });

  it("ordena campanhas mais recentes primeiro", () => {
    const resultado = agruparPorCampanha(
      [
        artefato({ id: "a1", missionId: "m1", missionTitulo: "Antiga" }),
        artefato({ id: "a2", missionId: "m2", missionTitulo: "Nova" }),
      ],
      [
        { id: "m1", objetivo: null, status: null, createdAt: "2026-01-01T00:00:00Z" },
        { id: "m2", objetivo: null, status: null, createdAt: "2026-02-01T00:00:00Z" },
      ],
    );
    expect(resultado.map((c) => c.titulo)).toEqual(["Nova", "Antiga"]);
  });
});
