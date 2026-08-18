import { createSupabaseServerClient } from "@/lib/supabase/server";
import BancoDeImagensPainel from "./BancoDeImagensPainel";

export default async function BancoDeImagensPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();
  if (!usuario?.cliente_id) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = usuario.cliente_id;

  const [{ data: pastas }, { data: assets }, { data: brandKit }] = await Promise.all([
    supabase
      .from("business_asset_folders")
      .select("id, parent_id, nome, categoria, created_at")
      .eq("cliente_id", clienteId)
      .order("nome"),
    supabase
      .from("business_assets")
      .select(
        "id, storage_path, nome, pasta, folder_id, tags, categoria, descricao, status, is_logo_principal, favorito, mime_type, created_at, updated_at",
      )
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_kits")
      .select(
        "id, logo_principal_asset_id, logo_fundo_claro_asset_id, logo_fundo_escuro_asset_id, logo_monocromatica_asset_id, simbolo_asset_id, logo_por_formato",
      )
      .eq("cliente_id", clienteId)
      .eq("is_atual", true)
      .maybeSingle(),
  ]);

  const assetsComUrl = await Promise.all(
    (assets ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(a.storage_path as string, 60 * 60);
      return {
        id: a.id as string,
        nome: a.nome as string,
        pasta: a.pasta as string,
        folderId: a.folder_id as string | null,
        tags: (a.tags as string[]) ?? [],
        categoria: a.categoria as string,
        descricao: a.descricao as string | null,
        status: a.status as string,
        isLogoPrincipal: a.is_logo_principal as boolean,
        favorito: a.favorito as boolean,
        mimeType: a.mime_type as string | null,
        createdAt: a.created_at as string,
        updatedAt: a.updated_at as string,
        url: signed?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Drive da empresa</h1>
        <p className="mt-2 text-sm text-areia/60">
          Contexto visual real do negócio — logos, produtos, equipe, ambientes, campanhas e documentos. O agente de
          Design consulta este Drive antes de criar qualquer peça, e nunca inventa um ativo que não está aqui.
        </p>

        <BancoDeImagensPainel
          clienteId={clienteId}
          assetsIniciais={assetsComUrl}
          pastasIniciais={(pastas ?? []).map((p) => ({
            id: p.id as string,
            parentId: p.parent_id as string | null,
            nome: p.nome as string,
            categoria: p.categoria as string | null,
          }))}
          brandKitInicial={
            brandKit
              ? {
                  id: brandKit.id as string,
                  logoPrincipalAssetId: brandKit.logo_principal_asset_id as string | null,
                  logoFundoClaroAssetId: brandKit.logo_fundo_claro_asset_id as string | null,
                  logoFundoEscuroAssetId: brandKit.logo_fundo_escuro_asset_id as string | null,
                  logoMonocromaticaAssetId: brandKit.logo_monocromatica_asset_id as string | null,
                  simboloAssetId: brandKit.simbolo_asset_id as string | null,
                  logoPorFormato: (brandKit.logo_por_formato as Record<string, string>) ?? {},
                }
              : null
          }
        />
      </div>
    </div>
  );
}
