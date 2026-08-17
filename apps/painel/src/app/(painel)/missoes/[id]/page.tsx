import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import VetorMissionTimeline from "@/components/VetorMissionTimeline";

export default async function MissaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: missao } = await supabase
    .from("missions")
    .select("id, titulo, objetivo, hipotese, status, criterio_sucesso, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!missao) notFound();

  const { data: etapas } = await supabase
    .from("mission_steps")
    .select("id, agente, tarefa, status, risco, resultado, depende_de, created_at")
    .eq("mission_id", id)
    .order("created_at", { ascending: true });

  const { data: aprovacoes } = await supabase
    .from("approvals")
    .select("id, mission_step_id, acao, risco, status")
    .eq("mission_id", id);

  const { data: artefatosBrutos } = await supabase
    .from("artifacts")
    .select("id, mission_step_id, type, title, status, storage_provider, storage_path, metadata")
    .eq("mission_id", id);

  // URL assinada (bucket próprio) ou URL externa direta (ex: Higgsfield) —
  // nunca expõe o bucket publicamente. Resolvido aqui (server) porque
  // storage.objects exige a policy de select scoped por cliente_id, mais
  // simples de resolver com a sessão já carregada nesta página.
  const artefatos = await Promise.all(
    (artefatosBrutos ?? []).map(async (a) => {
      let url: string | null = null;
      if (a.storage_provider === "external") {
        url = a.storage_path as string | null;
      } else if (a.storage_provider === "supabase" && a.storage_path) {
        const { data } = await supabase.storage.from("artifacts").createSignedUrl(a.storage_path as string, 60 * 60);
        url = data?.signedUrl ?? null;
      }
      return {
        id: a.id as string,
        missionStepId: a.mission_step_id as string | null,
        type: a.type as string,
        title: a.title as string,
        status: a.status as string,
        content: (a.metadata as { content?: string } | null)?.content ?? null,
        url,
      };
    }),
  );

  return (
    <main className="min-h-screen bg-petroleo px-6 py-10 text-areia">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <Link href="/missoes" className="font-mono text-xs uppercase tracking-wide text-areia/50 hover:text-menta">
            ← Missões
          </Link>
          <StatusBadge status={missao.status} />
        </div>

        <h1 className="mt-3 text-2xl font-bold text-areia">{missao.titulo}</h1>
        <p className="mt-2 text-sm text-areia/70">{missao.objetivo}</p>
        {missao.hipotese && (
          <p className="mt-1 text-xs text-areia/50">
            <span className="text-areia/70">Hipótese:</span> {missao.hipotese}
          </p>
        )}

        {Array.isArray(missao.criterio_sucesso) && missao.criterio_sucesso.length > 0 && (
          <div className="mt-3 rounded-xl border border-areia/10 bg-petroleo-2/60 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">Critério de sucesso</p>
            <ul className="mt-1 space-y-1 text-xs text-areia/70">
              {missao.criterio_sucesso.map((c: string, i: number) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">Andamento</h2>
          <div className="mt-3">
            <VetorMissionTimeline missionId={missao.id} etapas={etapas ?? []} approvals={aprovacoes ?? []} artefatos={artefatos} />
          </div>
        </section>
      </div>
    </main>
  );
}
