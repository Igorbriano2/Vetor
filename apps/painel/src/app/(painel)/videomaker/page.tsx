import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import VideomakerUpload from "./VideomakerUpload";

const STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  analyzing: "analisando",
  editing: "editando",
  awaiting_approval: "aguardando aprovação",
  rendering: "renderizando",
  completed: "concluído",
  failed: "falhou",
  approved: "aprovado",
};

// Vídeos finalizados pelo agente de edição (Higgsfield) continuam aqui
// (upload único + biblioteca de entregas — caminho legado preservado). A
// seção "Projetos editáveis" acima é o novo videomaker com timeline não
// destrutiva (Parte 2) — os dois convivem, nada do fluxo antigo quebrou.
export default async function VideomakerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();
  const artefatos = await buscarArtefatos(supabase, { departamentos: ["videomaker"] });

  const { data: projetos } = await supabase
    .from("video_projects")
    .select("id, title, timeline_version, status, duration_ms, updated_at, mission_id, missions(titulo)")
    .order("updated_at", { ascending: false })
    .limit(30);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
            <h1 className="mt-1 text-2xl font-bold text-areia">Videomaker</h1>
            <p className="mt-2 text-sm text-areia/60">
              Envie um arquivo de origem e descreva o que quer, ou peça direto pelo chat principal — o
              resultado aparece na biblioteca abaixo.
            </p>
          </div>
          <Link
            href="/videomaker/editor"
            className="mt-1 shrink-0 rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
          >
            + Novo vídeo
          </Link>
        </div>

        {projetos && projetos.length > 0 && (
          <div className="mt-8">
            <p className="mono-label mb-3 text-areia/50">Projetos editáveis</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {projetos.map((p) => (
                <Link
                  key={p.id as string}
                  href={`/videomaker/editor/${p.id}`}
                  className="group overflow-hidden rounded-xl border border-areia/10 bg-petroleo-2/60 p-3 transition hover:border-menta/40"
                >
                  <p className="truncate text-sm text-areia">{p.title as string}</p>
                  <p className="mt-1 text-[11px] text-areia/40">
                    v{p.timeline_version as number} · {STATUS_LABEL[p.status as string] ?? (p.status as string)} ·{" "}
                    {(((p.duration_ms as number) ?? 0) / 1000).toFixed(1)}s
                  </p>
                  {p.mission_id && (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-areia/30">
                      campanha: {(p.missions as unknown as { titulo?: string } | null)?.titulo ?? "missão"}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {usuario?.cliente_id && (
          <div className="mt-8">
            <VideomakerUpload clienteId={usuario.cliente_id} />
          </div>
        )}

        <div className="mt-8">
          <p className="mono-label mb-3 text-areia/50">Entregas</p>
          <ArtifactLibrary artefatos={artefatos} vazio="Nenhum vídeo ainda — peça uma edição ou animação pro Vetor no chat." />
        </div>
      </div>
    </div>
  );
}
