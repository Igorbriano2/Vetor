import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import ArtifactLibrary from "@/components/ArtifactLibrary";

// Biblioteca visual do Design — organizada por solicitação/missão (ver
// artifacts.mission_id) em vez de pastas físicas nesta rodada: cada card já
// leva pra missão de origem. Hoje mostra sobretudo briefings (documento),
// já que não existe gerador de imagem real configurado — ver
// apps/agentes/src/agents/prompts/design.md.
export default async function DesignPage() {
  const supabase = await createSupabaseServerClient();
  const artefatos = await buscarArtefatos(supabase, { departamentos: ["design"] });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Design</h1>
        <p className="mt-2 text-sm text-areia/60">
          Artes, briefings e peças criadas pelo Vetor, organizadas por solicitação e missão.
        </p>

        <div className="mt-8">
          <ArtifactLibrary artefatos={artefatos} vazio="Nenhuma peça de design ainda — peça algo pro Vetor no chat." />
        </div>
      </div>
    </div>
  );
}
