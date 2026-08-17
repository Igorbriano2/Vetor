import { supabase } from "../db/supabase.js";

// Banco de imagens do cliente — consultado antes de Design/Vídeo produzirem
// algo, pra usar referência real em vez de inventar. Limitado (10 mais
// recentes) pra não inflar o prompt; busca por tag quando fizer sentido.
export interface AssetDisponivel {
  nome: string;
  url: string;
  tags: string[];
}

export async function buscarAssetsRelevantes(clienteId: string, limite = 10): Promise<AssetDisponivel[]> {
  const { data } = await supabase
    .from("business_assets")
    .select("nome, storage_path, tags")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (!data || data.length === 0) return [];

  return Promise.all(
    data.map(async (a) => {
      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(a.storage_path as string, 60 * 60);
      return {
        nome: a.nome as string,
        url: signed?.signedUrl ?? "",
        tags: Array.isArray(a.tags) ? (a.tags as string[]) : [],
      };
    }),
  ).then((assets) => assets.filter((a) => a.url));
}
