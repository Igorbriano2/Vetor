import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import VideomakerUpload from "./VideomakerUpload";
import { calcularProgresso, LABEL_ETAPA_REAL } from "@/lib/video/pipelineProgress";

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
  const ativo = await resolverClienteAtivo(supabase);
  const artefatos = await buscarArtefatos(supabase, { departamentos: ["videomaker"], clienteId: ativo.clienteId ?? undefined });

  const { data: projetos } = await supabase
    .from("video_projects")
    .select("id, title, timeline_version, status, duration_ms, updated_at, mission_id, missions(titulo)")
    .eq("cliente_id", ativo.clienteId ?? "")
    .order("updated_at", { ascending: false })
    .limit(30);

  // Fase 7 do reset de produto — progresso real por projeto (só os 5
  // estágios que têm código de verdade, ver pipelineProgress.ts).
  const projetoIds = (projetos ?? []).map((p) => p.id as string);
  const { data: estagiosBrutos } = projetoIds.length
    ? await supabase.from("video_pipeline_stages").select("video_project_id, stage, status").in("video_project_id", projetoIds)
    : { data: [] };
  const estagiosPorProjeto = new Map<string, Array<{ stage: string; status: string }>>();
  for (const e of estagiosBrutos ?? []) {
    const lista = estagiosPorProjeto.get(e.video_project_id as string) ?? [];
    lista.push({ stage: e.stage as string, status: e.status as string });
    estagiosPorProjeto.set(e.video_project_id as string, lista);
  }

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
              {projetos.map((p) => {
                const progresso = calcularProgresso(estagiosPorProjeto.get(p.id as string) ?? []);
                return (
                  <Link
                    key={p.id as string}
                    href={`/videomaker/editor/${p.id}`}
                    className="group overflow-hidden rounded-xl card-lift panel p-3"
                  >
                    <p className="truncate text-sm text-areia">{p.title as string}</p>
                    <p className="mt-1 text-[11px] text-areia/40">
                      v{p.timeline_version as number} · {STATUS_LABEL[p.status as string] ?? (p.status as string)} ·{" "}
                      {(((p.duration_ms as number) ?? 0) / 1000).toFixed(1)}s
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      {Array.from({ length: progresso.total }).map((_, i) => (
                        <span key={i} className={`h-1 flex-1 rounded-full ${i < progresso.concluidas ? "bg-menta" : "bg-areia/15"}`} />
                      ))}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-areia/30">
                      {progresso.etapaAtual ? `Próxima: ${LABEL_ETAPA_REAL[progresso.etapaAtual]}` : "Pipeline completo"}
                    </p>
                    {p.mission_id && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-areia/30">
                        campanha: {(p.missions as unknown as { titulo?: string } | null)?.titulo ?? "missão"}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {ativo.clienteId && (
          <div className="mt-8">
            <VideomakerUpload clienteId={ativo.clienteId} />
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
