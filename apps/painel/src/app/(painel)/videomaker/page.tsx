import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import ArtifactLibrary from "@/components/ArtifactLibrary";

// Vídeos finalizados pelo agente de edição (Higgsfield) — pedir um vídeo
// continua sendo feito pelo chat do Vetor (não existe uma tela separada de
// upload/job ainda); esta página é a biblioteca do que já foi gerado.
export default async function VideomakerPage() {
  const supabase = await createSupabaseServerClient();
  const artefatos = await buscarArtefatos(supabase, { departamentos: ["videomaker"] });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Videomaker</h1>
        <p className="mt-2 text-sm text-areia/60">
          Vídeos gerados/editados pelo Vetor. Peça pelo chat: &ldquo;corte o vídeo em um Reel de 20 segundos...&rdquo; — o
          Vetor cria a missão, executa e o resultado aparece aqui.
        </p>

        <div className="mt-8">
          <ArtifactLibrary artefatos={artefatos} vazio="Nenhum vídeo ainda — peça uma edição ou animação pro Vetor no chat." />
        </div>
      </div>
    </div>
  );
}
