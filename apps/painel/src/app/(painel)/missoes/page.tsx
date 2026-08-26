import { createSupabaseServerClient } from "@/lib/supabase/server";
import MissoesView from "./MissoesView";

// Design V2 (auditoria Gravyx — "Tarefas") — visão Kanban somada à lista já
// existente, pra dar visão operacional real do que está em cada etapa sem
// precisar abrir cada missão. Kanban é só reagrupamento visual (ver
// MissoesView.tsx) — nenhuma mudança na Mission Orchestrator nem nos
// status reais.
export default async function MissoesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: missoes } = await supabase
    .from("missions")
    .select("id, titulo, objetivo, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">VETOR / MISSÕES</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Missões</h1>
        <p className="mt-2 text-sm text-areia/60">Tudo que o Vetor está executando ou já executou, por etapa.</p>

        <div className="mt-8">
          <MissoesView
            missoes={(missoes ?? []).map((m) => ({
              id: m.id as string,
              titulo: m.titulo as string,
              objetivo: m.objetivo as string,
              status: m.status as string,
              created_at: m.created_at as string,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
