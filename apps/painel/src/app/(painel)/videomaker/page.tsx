import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import VideomakerUpload from "./VideomakerUpload";

// Vídeos finalizados pelo agente de edição (Higgsfield). O upload de origem
// abaixo reaproveita o mesmo pipeline de missão do chat principal — não é um
// sistema de job paralelo, só anexa a URL do arquivo no pedido de texto.
export default async function VideomakerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();
  const artefatos = await buscarArtefatos(supabase, { departamentos: ["videomaker"] });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Videomaker</h1>
        <p className="mt-2 text-sm text-areia/60">
          Envie um arquivo de origem e descreva o que quer, ou peça direto pelo chat principal — o resultado
          aparece na biblioteca abaixo.
        </p>

        {usuario?.cliente_id && (
          <div className="mt-6">
            <VideomakerUpload clienteId={usuario.cliente_id} />
          </div>
        )}

        <div className="mt-8">
          <ArtifactLibrary artefatos={artefatos} vazio="Nenhum vídeo ainda — peça uma edição ou animação pro Vetor no chat." />
        </div>
      </div>
    </div>
  );
}
