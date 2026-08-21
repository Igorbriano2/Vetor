import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverUrlsDoCanvas } from "@/lib/design/resolveCanvasUrls";
import DesignProjectEditor from "@/components/design/DesignProjectEditor";

export default async function DesignProjectEditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: projeto } = await supabase
    .from("design_projects")
    .select("id, cliente_id, title, width, height, canvas_json, version, status")
    .eq("id", projectId)
    .maybeSingle();

  if (!projeto) notFound();

  // URL assinada expira — nunca confia na que eventualmente esteja gravada
  // no canvasJson (ex: projetos criados pelo agente, que só gravam
  // storagePath). Reassina toda vez que o projeto é aberto.
  const canvasJsonComUrlsFrescas = await resolverUrlsDoCanvas(supabase, projeto.canvas_json);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/criacoes" className="font-mono text-xs uppercase tracking-wide text-areia/40 hover:text-menta">
          ← Voltar para Criações
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-areia">Editor de Design</h1>
        <p className="mt-2 text-sm text-areia/60">
          Selecione um elemento pra editar. A logo oficial fica bloqueada por padrão — nunca é removida ou distorcida
          sem uma ação explícita autorizada pelo BrandKit.
        </p>

        <div className="mt-8">
          <DesignProjectEditor
            projeto={{
              id: projeto.id as string,
              clienteId: projeto.cliente_id as string,
              title: projeto.title as string,
              width: projeto.width as number,
              height: projeto.height as number,
              canvasJson: canvasJsonComUrlsFrescas,
              version: projeto.version as number,
              status: projeto.status as "draft" | "awaiting_approval" | "approved" | "archived",
            }}
          />
        </div>
      </div>
    </div>
  );
}
