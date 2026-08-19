import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverUrlsDosClipes } from "@/lib/video/resolveClipUrls";
import VideoProjectEditor from "@/components/video/VideoProjectEditor";

export default async function VideoProjectEditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: projeto } = await supabase
    .from("video_projects")
    .select("id, cliente_id, title, timeline_json, timeline_version, status, output_storage_path")
    .eq("id", projectId)
    .maybeSingle();

  if (!projeto) notFound();

  const timelineJson = projeto.timeline_json as import("@/lib/video/timelineTypes").TimelineDocument;
  const clipUrls = await resolverUrlsDosClipes(supabase, timelineJson);

  // MP4 final de verdade (mesmo storage path gravado por
  // atualizarRenderFinalDoVideoProject no agente) — URL assinada FRESCA a
  // cada abertura, nunca uma URL guardada (expira).
  let outputUrl: string | null = null;
  if (projeto.output_storage_path) {
    const { data: assinada } = await supabase.storage
      .from("artifacts")
      .createSignedUrl(projeto.output_storage_path as string, 60 * 60);
    outputUrl = assinada?.signedUrl ?? null;
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Editor de Vídeo</h1>
        <p className="mt-2 text-sm text-areia/60">
          Selecione um clip na timeline pra editar. Edição não destrutiva — nada aqui altera o arquivo de
          origem no Drive.
        </p>

        <div className="mt-8">
          <VideoProjectEditor
            projeto={{
              id: projeto.id as string,
              clienteId: projeto.cliente_id as string,
              title: projeto.title as string,
              timelineJson,
              timelineVersion: projeto.timeline_version as number,
              status: projeto.status as import("@/lib/video/timelineTypes").VideoProjectStatus,
              clipUrls,
              outputUrl,
            }}
          />
        </div>
      </div>
    </div>
  );
}
