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

  const { data: assets } = await supabase
    .from("business_assets")
    .select("id, storage_path, nome, pasta, tags, created_at")
    .eq("cliente_id", usuario.cliente_id)
    .order("created_at", { ascending: false });

  const assetsComUrl = await Promise.all(
    (assets ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(a.storage_path as string, 60 * 60);
      return {
        id: a.id as string,
        nome: a.nome as string,
        pasta: a.pasta as string,
        tags: (a.tags as string[]) ?? [],
        createdAt: a.created_at as string,
        url: signed?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Banco de imagens</h1>
        <p className="mt-2 text-sm text-areia/60">
          Referências que o Vetor consulta antes de produzir peças de Design e Vídeo. Organize por pasta e tags pra
          facilitar a busca.
        </p>

        <BancoDeImagensPainel clienteId={usuario.cliente_id} assetsIniciais={assetsComUrl} />
      </div>
    </div>
  );
}
