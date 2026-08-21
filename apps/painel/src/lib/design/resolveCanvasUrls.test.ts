import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverUrlsDoCanvas } from "./resolveCanvasUrls";

// Achado real testando "Baixar PNG" ao vivo em produção (Fase 9/10): sem
// crossOrigin no objeto de imagem, o Fabric.js carrega a imagem sem o
// atributo crossOrigin do <img>, o canvas fica "tainted" mesmo com o
// Storage permitindo CORS, e toDataURL()/toBlob() lança SecurityError.
// Bug pré-existente que também afetava silenciosamente "Exportar PNG"/
// "Exportar JPG" do spike do canvas, não só o botão novo desta rodada.
function criarSupabaseFake(signedUrlPorPath: Record<string, string>): SupabaseClient {
  return {
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          const url = signedUrlPorPath[path];
          return url ? { data: { signedUrl: url } } : { data: null };
        },
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("resolverUrlsDoCanvas", () => {
  it("toda imagem resolvida ganha crossOrigin: anonymous, nunca só o src", async () => {
    const supabase = criarSupabaseFake({ "x/fundo.png": "https://storage.example/x/fundo.png?token=abc" });
    const canvasJson = {
      version: "7.4.0",
      objects: [
        { type: "image", vetorMeta: { storagePath: "x/fundo.png", bucket: "artifacts" } },
        { type: "textbox", text: "Headline" },
      ],
    };

    const resolvido = (await resolverUrlsDoCanvas(supabase, canvasJson)) as { objects: Array<Record<string, unknown>> };

    expect(resolvido.objects[0]).toMatchObject({
      src: "https://storage.example/x/fundo.png?token=abc",
      crossOrigin: "anonymous",
    });
  });

  it("objeto sem storagePath/bucket (ex: texto, forma) fica intocado — nunca ganha src/crossOrigin do nada", async () => {
    const supabase = criarSupabaseFake({});
    const canvasJson = { objects: [{ type: "textbox", text: "CTA" }, { type: "rect", fill: "#000" }] };

    const resolvido = (await resolverUrlsDoCanvas(supabase, canvasJson)) as { objects: Array<Record<string, unknown>> };

    expect(resolvido.objects[0]).not.toHaveProperty("crossOrigin");
    expect(resolvido.objects[1]).not.toHaveProperty("crossOrigin");
  });

  it("falha ao assinar (arquivo removido do storage) devolve o objeto original, nunca quebra o canvas inteiro", async () => {
    const supabase = criarSupabaseFake({});
    const canvasJson = { objects: [{ type: "image", vetorMeta: { storagePath: "x/sumiu.png", bucket: "artifacts" } }] };

    const resolvido = (await resolverUrlsDoCanvas(supabase, canvasJson)) as { objects: Array<Record<string, unknown>> };

    expect(resolvido.objects[0]).not.toHaveProperty("src");
    expect(resolvido.objects[0]).not.toHaveProperty("crossOrigin");
  });

  it("canvasJson nulo/sem objects passa direto, nunca lança erro", async () => {
    const supabase = criarSupabaseFake({});
    await expect(resolverUrlsDoCanvas(supabase, null)).resolves.toBeNull();
    await expect(resolverUrlsDoCanvas(supabase, { version: "7.4.0" })).resolves.toEqual({ version: "7.4.0" });
  });
});
