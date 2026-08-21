import type { SupabaseClient } from "@supabase/supabase-js";
import type { VetorObjectMeta } from "./types";

// URL assinada expira (1h–7d); o storage_path gravado no canvasJson não.
// Toda vez que um design_project é aberto no servidor, reassina cada objeto
// de imagem que tem vetorMeta.storagePath pra um `src` fresco — nunca grava
// a URL assinada de volta no banco (ver designProjects.ts no apps/agentes,
// que só grava storagePath desde a criação).
const TTL_SEGUNDOS = 60 * 60;

interface ObjetoCanvasComMeta {
  type?: string;
  src?: string;
  vetorMeta?: VetorObjectMeta;
  [chave: string]: unknown;
}

export async function resolverUrlsDoCanvas(supabase: SupabaseClient, canvasJson: unknown): Promise<unknown> {
  if (!canvasJson || typeof canvasJson !== "object") return canvasJson;
  const objetos = (canvasJson as { objects?: unknown }).objects;
  if (!Array.isArray(objetos)) return canvasJson;

  const objetosResolvidos = await Promise.all(
    objetos.map(async (objetoBruto) => {
      const objeto = objetoBruto as ObjetoCanvasComMeta;
      const storagePath = objeto.vetorMeta?.storagePath;
      const bucket = objeto.vetorMeta?.bucket;
      if (objeto.type !== "image" || !storagePath || !bucket) return objeto;

      const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, TTL_SEGUNDOS);
      if (!data?.signedUrl) return objeto;

      // Sem isso, o Fabric.js carrega a imagem sem o atributo crossOrigin
      // do elemento <img>, o canvas fica "tainted" (mesmo com o Storage
      // permitindo CORS) e qualquer toDataURL()/toBlob() depois lança
      // SecurityError — bug real encontrado testando "Baixar PNG" ao vivo,
      // que também já afetava silenciosamente os botões pré-existentes
      // "Exportar PNG"/"Exportar JPG" do spike do canvas.
      return { ...objeto, src: data.signedUrl, crossOrigin: "anonymous" };
    }),
  );

  return { ...(canvasJson as Record<string, unknown>), objects: objetosResolvidos };
}
