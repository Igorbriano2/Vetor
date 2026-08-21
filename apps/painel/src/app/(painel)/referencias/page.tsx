import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import ReferenciasPainel from "./ReferenciasPainel";

export default async function ReferenciasPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [{ data: itens }, { data: colecoes }, { data: itensDeColecao }, { data: assetsDrive }, { data: perfis }, { data: perfisImagem }] = await Promise.all([
    supabase
      .from("reference_library_items")
      // favorito (migration 0035) sustenta a coleção "Salvas"; created_by
      // sustenta o autor real no modal de detalhe (Fase 9).
      .select("id, cliente_id, source_type, asset_id, external_url, title, description, tags, department, direitos_uso, status, created_at, favorito, created_by")
      .or(`cliente_id.eq.${clienteId},cliente_id.is.null`)
      .eq("status", "ativo")
      .order("created_at", { ascending: false }),
    supabase
      .from("reference_collections")
      .select("id, cliente_id, nome, descricao, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reference_collection_items")
      .select("collection_id, reference_library_item_id")
      .eq("cliente_id", clienteId),
    supabase
      .from("business_assets")
      .select("id, nome, storage_path, mime_type")
      .eq("cliente_id", clienteId)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(100),
    // Fase 3 do Gravyx (Rodada C) — perfis de estilo já extraídos de itens
    // desta biblioteca (ver migration 0030), pra mostrar o resultado direto
    // no card em vez de só o botão "analisar" de novo a cada visita.
    supabase
      .from("reference_video_profiles")
      .select("reference_library_item_id, pacing, hook_structure, color_profile, composition_notes, cut_density_per_minute, music_energy, resumo_simples")
      .eq("cliente_id", clienteId)
      .not("reference_library_item_id", "is", null),
    // Fase 2 do reset de produto — perfil visual de imagem, mesmo padrão do
    // de vídeo acima (ver migration 0032).
    supabase
      .from("reference_image_profiles")
      .select("reference_library_item_id, composicao, grid, hierarquia, paleta, ritmo_visual, densidade, tipografia_descricao, tratamento_imagem, resumo_simples")
      .eq("cliente_id", clienteId)
      .not("reference_library_item_id", "is", null),
  ]);

  // Assina URL só dos assets que já viraram referência (upload) — evita
  // assinar centenas de urls do Drive inteiro à toa.
  const assetIdsUsados = new Set((itens ?? []).map((i) => i.asset_id as string | null).filter((v): v is string => !!v));
  const pathPorAssetId = new Map((assetsDrive ?? []).map((a) => [a.id as string, a.storage_path as string]));
  const mimeTypePorAssetId = new Map((assetsDrive ?? []).map((a) => [a.id as string, a.mime_type as string | null]));

  // Autor real (Fase 9 — modal de detalhe) — busca em lote, mesmo padrão
  // já usado pra assinar URLs de asset acima. Item curado (created_by
  // nulo) nunca tem autor individual — o modal mostra "Curado pelo Vetor".
  const autorIdsUsados = new Set((itens ?? []).map((i) => i.created_by as string | null).filter((v): v is string => !!v));
  const { data: autores } =
    autorIdsUsados.size > 0
      ? await supabase.from("usuarios").select("id, nome").in("id", Array.from(autorIdsUsados))
      : { data: [] };
  const nomePorAutorId = new Map((autores ?? []).map((u) => [u.id as string, u.nome as string]));
  const perfilPorItemId = new Map((perfis ?? []).map((p) => [p.reference_library_item_id as string, p]));
  const perfilImagemPorItemId = new Map((perfisImagem ?? []).map((p) => [p.reference_library_item_id as string, p]));
  const urlsAssinadas = new Map<string, string>();
  await Promise.all(
    Array.from(assetIdsUsados).map(async (assetId) => {
      const path = pathPorAssetId.get(assetId);
      if (!path) return;
      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60);
      if (signed?.signedUrl) urlsAssinadas.set(assetId, signed.signedUrl);
    }),
  );

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Biblioteca</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Referências</h1>
        <p className="mt-2 text-sm text-areia/60">
          Se inspire antes de pedir uma peça nova — categorias prontas do Vetor, ou suas próprias referências (link,
          Drive). Nunca copiado literalmente numa peça, só a linguagem visual.
        </p>

        <ReferenciasPainel
          clienteId={clienteId}
          itensIniciais={(itens ?? []).map((i) => ({
            id: i.id as string,
            clienteId: i.cliente_id as string | null,
            sourceType: i.source_type as "upload" | "external_url" | "curated",
            assetId: i.asset_id as string | null,
            externalUrl: i.external_url as string | null,
            title: i.title as string,
            description: i.description as string | null,
            tags: (i.tags as string[]) ?? [],
            department: i.department as string | null,
            direitosUso: i.direitos_uso as string | null,
            createdAt: i.created_at as string,
            thumbnailUrl: i.asset_id ? (urlsAssinadas.get(i.asset_id as string) ?? null) : null,
            isVideo: i.asset_id ? !!mimeTypePorAssetId.get(i.asset_id as string)?.startsWith("video/") : false,
            isImage: i.asset_id ? !!mimeTypePorAssetId.get(i.asset_id as string)?.startsWith("image/") : false,
            favorito: (i.favorito as boolean | null) ?? false,
            autorNome: i.created_by
              ? (nomePorAutorId.get(i.created_by as string) ?? null)
              : i.source_type === "curated" || i.cliente_id === null
                ? "Curado pelo Vetor"
                : null,
            perfilEstilo: (() => {
              const p = perfilPorItemId.get(i.id as string);
              if (!p) return null;
              return {
                pacing: p.pacing as string,
                hookStructure: p.hook_structure as string,
                colorProfile: p.color_profile as string,
                compositionNotes: p.composition_notes as string,
                cutDensityPerMinute: p.cut_density_per_minute as number,
                musicEnergy: p.music_energy as string,
                resumoSimples: p.resumo_simples as string | null,
              };
            })(),
            perfilVisual: (() => {
              const p = perfilImagemPorItemId.get(i.id as string);
              if (!p) return null;
              return {
                composicao: p.composicao as string,
                grid: p.grid as string,
                hierarquia: p.hierarquia as string,
                paleta: p.paleta as string,
                ritmoVisual: p.ritmo_visual as string,
                densidade: p.densidade as string,
                tipografiaDescricao: p.tipografia_descricao as string,
                tratamentoImagem: p.tratamento_imagem as string,
                resumoSimples: p.resumo_simples as string | null,
              };
            })(),
          }))}
          colecoesIniciais={(colecoes ?? []).map((c) => ({
            id: c.id as string,
            nome: c.nome as string,
            descricao: c.descricao as string | null,
          }))}
          itensPorColecaoIniciais={(itensDeColecao ?? []).map((r) => ({
            collectionId: r.collection_id as string,
            itemId: r.reference_library_item_id as string,
          }))}
          assetsDrive={(assetsDrive ?? []).map((a) => ({
            id: a.id as string,
            nome: a.nome as string,
            mimeType: a.mime_type as string | null,
          }))}
        />
      </div>
    </div>
  );
}
