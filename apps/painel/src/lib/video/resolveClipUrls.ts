import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimelineDocument } from "./timelineTypes";

// Clip.sourceAssetId é o id do business_asset, nunca uma URL — resolve pra
// URL assinada FRESCA a cada abertura do projeto (mesma lógica de
// resolveCanvasUrls.ts pro Design: URL assinada expira, o id do asset
// não). Devolve um mapa separado em vez de mutar o timelineJson, porque
// Clip não tem um campo "src" — é o componente client que decide qual URL
// usar pra cada sourceAssetId na hora de tocar o preview.
export async function resolverUrlsDosClipes(supabase: SupabaseClient, timeline: TimelineDocument): Promise<Record<string, string>> {
  const assetIds = new Set<string>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) assetIds.add(clip.sourceAssetId);
  }
  if (assetIds.size === 0) return {};

  const { data } = await supabase.from("business_assets").select("id, storage_path").in("id", [...assetIds]);
  if (!data) return {};

  const mapa: Record<string, string> = {};
  await Promise.all(
    data.map(async (a) => {
      const { data: assinada } = await supabase.storage.from("brand-assets").createSignedUrl(a.storage_path as string, 60 * 60);
      if (assinada?.signedUrl) mapa[a.id as string] = assinada.signedUrl;
    }),
  );
  return mapa;
}
