import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import VetorMissionTimeline from "@/components/VetorMissionTimeline";
import MissionCanvas from "@/components/MissionCanvas";

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

  // Fase 4 do reset de produto — status amigável de peça (docs/PRODUCT-RESET-AUDIT.md)
  // precisa saber se existe um design_project ligado à etapa e em que status
  // (draft/approved) ele está. mission_step_id é real (migration 0021),
  // nunca inferido.
  const etapaIds = (etapas ?? []).map((e) => e.id as string);
  const { data: designProjectsBrutos } = etapaIds.length
    ? await supabase.from("design_projects").select("mission_step_id, status, version").in("mission_step_id", etapaIds)
    : { data: [] };
  const designProjectPorEtapa = new Map(
    (designProjectsBrutos ?? []).map((d) => [d.mission_step_id as string, { status: d.status as string, version: d.version as number }]),
  );

  // Fase 6 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — custo real
  // por etapa no Canvas (agent_runs.custo_estimado_centavos, confirmado
  // populado em produção). Soma quando há mais de uma chamada/retry na
  // mesma etapa; etapa sem nenhum run fica ausente do Map (nunca 0 fabricado).
  const { data: runsBrutos } = etapaIds.length
    ? await supabase.from("agent_runs").select("mission_step_id, custo_estimado_centavos").in("mission_step_id", etapaIds)
    : { data: [] };
  const custoPorEtapa = new Map<string, number>();
  for (const r of runsBrutos ?? []) {
    const stepId = r.mission_step_id as string;
    const custo = r.custo_estimado_centavos as number | null;
    if (custo == null) continue;
    custoPorEtapa.set(stepId, (custoPorEtapa.get(stepId) ?? 0) + custo);
  }

  // Fase 7 do reset de produto — o projeto de vídeo (editável desde a
  // primeira etapa, não só depois do render final) precisa de um link
  // direto assim que existir, nunca deixar o cliente preso numa frase
  // técnica até o final_render acontecer. video_projects.mission_step_id
  // é real (migration 0023), mesmo padrão do design_project acima.
  const { data: videoProjectsBrutos } = etapaIds.length
    ? await supabase.from("video_projects").select("id, mission_step_id, status, output_storage_path").in("mission_step_id", etapaIds)
    : { data: [] };
  const videoProjectPorEtapa = new Map(
    (videoProjectsBrutos ?? []).map((v) => [
      v.mission_step_id as string,
      { id: v.id as string, status: v.status as string, temRenderFinal: !!v.output_storage_path },
    ]),
  );

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
          <div className="mt-3 rounded-xl panel p-3">
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
            <VetorMissionTimeline
              missionId={missao.id}
              missaoStatus={missao.status}
              etapas={etapas ?? []}
              approvals={aprovacoes ?? []}
              artefatos={artefatos}
              designProjectPorEtapa={Object.fromEntries(designProjectPorEtapa)}
              videoProjectPorEtapa={Object.fromEntries(videoProjectPorEtapa)}
            />
          </div>
        </section>

        {(etapas ?? []).length > 0 && (
          <details className="mt-6 group">
            <summary className="cursor-pointer font-mono text-xs font-semibold uppercase tracking-widest text-areia/40 hover:text-areia/70">
              Ver como canvas ▸
            </summary>
            <div className="mt-3">
              <MissionCanvas
                etapas={(etapas ?? []).map((e) => ({
                  id: e.id as string,
                  agente: e.agente as string,
                  tarefa: e.tarefa as string,
                  status: e.status as string,
                  dependeDe: (e.depende_de as string[] | null) ?? [],
                  custoEstimadoCentavos: custoPorEtapa.get(e.id as string) ?? null,
                }))}
              />
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
