import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReferenciasPainel from "./ReferenciasPainel";

export default async function ReferenciasPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();
  if (!usuario?.cliente_id) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = usuario.cliente_id;

  const [{ data: itens }, { data: colecoes }, { data: itensDeColecao }, { data: assetsDrive }] = await Promise.all([
    supabase
      .from("reference_library_items")
      .select("id, cliente_id, source_type, asset_id, external_url, title, description, tags, department, direitos_uso, status, created_at")
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
      .select("id, nome, storage_path")
      .eq("cliente_id", clienteId)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Assina URL só dos assets que já viraram referência (upload) — evita
  // assinar centenas de urls do Drive inteiro à toa.
  const assetIdsUsados = new Set((itens ?? []).map((i) => i.asset_id as string | null).filter((v): v is string => !!v));
  const pathPorAssetId = new Map((assetsDrive ?? []).map((a) => [a.id as string, a.storage_path as string]));
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
          Reúna inspirações de estilo antes de pedir uma peça — link externo que você colar, arquivo já no Drive da
          empresa, ou itens curados pelo time Vetor. É catálogo de inspiração, nunca copiado literalmente numa peça
          (isso continua sendo só a matéria-prima real do Drive).
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
          assetsDrive={(assetsDrive ?? []).map((a) => ({ id: a.id as string, nome: a.nome as string }))}
        />
      </div>
    </div>
  );
}
