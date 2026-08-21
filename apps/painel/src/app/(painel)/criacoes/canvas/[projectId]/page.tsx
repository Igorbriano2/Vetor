import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreativeCanvasEditor from "@/components/canvas/CreativeCanvasEditor";
import { grafoVazio, type GraphJson } from "@/lib/canvas/types";

export default async function CreativeCanvasProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: projeto } = await supabase
    .from("creative_canvas_projects")
    .select("id, title, graph_json")
    .eq("id", projectId)
    .maybeSingle();

  if (!projeto) notFound();

  const graph = (projeto.graph_json as GraphJson | null) ?? grafoVazio();

  return <CreativeCanvasEditor projectId={projeto.id as string} tituloInicial={projeto.title as string} graphInicial={graph} />;
}
