import Link from "next/link";
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

  const { data: projetos } = await supabase
    .from("design_projects")
    .select("id, title, version, status, thumbnail_url, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
            <h1 className="mt-1 text-2xl font-bold text-areia">Design</h1>
            <p className="mt-2 text-sm text-areia/60">
              Artes, briefings e peças criadas pelo Vetor, organizadas por solicitação e missão.
            </p>
          </div>
          <Link
            href="/design/editor"
            className="mt-1 shrink-0 rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
          >
            + Novo design
          </Link>
        </div>

        {projetos && projetos.length > 0 && (
          <div className="mt-8">
            <p className="mono-label mb-3 text-areia/50">Projetos editáveis</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {projetos.map((p) => (
                <Link
                  key={p.id as string}
                  href={`/design/editor/${p.id}`}
                  className="group overflow-hidden rounded-xl border border-areia/10 bg-petroleo-2/60 transition hover:border-menta/40"
                >
                  <div className="flex aspect-square items-center justify-center bg-petroleo">
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail_url as string} alt={p.title as string} className="size-full object-cover" />
                    ) : (
                      <span className="text-xs text-areia/30">sem prévia</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs text-areia">{p.title as string}</p>
                    <p className="text-[11px] text-areia/40">
                      v{p.version as number} · {p.status as string}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <p className="mono-label mb-3 text-areia/50">Entregas</p>
          <ArtifactLibrary artefatos={artefatos} vazio="Nenhuma peça de design ainda — peça algo pro Vetor no chat." />
        </div>
      </div>
    </div>
  );
}
