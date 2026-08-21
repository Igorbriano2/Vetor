import type { SupabaseClient } from "@supabase/supabase-js";
import { classificarStatusStep } from "./statusProgresso";

// Design V2 (prompt "reconstrução seletiva") — Fase 1: "Em produção" e "Com
// falha" precisam ser estados REAIS na galeria, não placeholder. Reaproveita
// mission_steps/agent_runs (já existentes, nunca uma tabela nova) — mesma
// fonte que /design já usa pra "etapas em andamento" (ver design/page.tsx).
// agente 'design'/'video' são os dois valores reais usados pelo
// specialistRunner pra peças visuais (Design e Videomaker).
export interface PecaEmProgresso {
  id: string;
  tarefa: string;
  missionId: string;
  missionTitulo: string;
  agente: string;
  status: string;
  createdAt: string;
  erroResumo: string | null;
}

export async function buscarPecasEmProgresso(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  clienteId: string,
): Promise<{ emProducao: PecaEmProgresso[]; comFalha: PecaEmProgresso[] }> {
  const { data: passos } = await supabase
    .from("mission_steps")
    .select("id, tarefa, status, agente, mission_id, created_at, missions(titulo)")
    .eq("cliente_id", clienteId)
    .in("agente", ["design", "video"])
    .order("created_at", { ascending: false })
    .limit(60);

  const lista = passos ?? [];
  const idsComFalha = lista.filter((p) => classificarStatusStep(p.status as string) === "com_falha").map((p) => p.id as string);

  const erroPorStep = new Map<string, string>();
  if (idsComFalha.length > 0) {
    const { data: runs } = await supabase
      .from("agent_runs")
      .select("mission_step_id, erro, created_at")
      .in("mission_step_id", idsComFalha)
      .not("erro", "is", null)
      .order("created_at", { ascending: false });
    for (const r of runs ?? []) {
      const stepId = r.mission_step_id as string;
      if (!erroPorStep.has(stepId)) erroPorStep.set(stepId, r.erro as string);
    }
  }

  const emProducao: PecaEmProgresso[] = [];
  const comFalha: PecaEmProgresso[] = [];

  for (const p of lista) {
    const classe = classificarStatusStep(p.status as string);
    if (!classe) continue;
    const item: PecaEmProgresso = {
      id: p.id as string,
      tarefa: p.tarefa as string,
      missionId: p.mission_id as string,
      missionTitulo: (p.missions as unknown as { titulo?: string } | null)?.titulo ?? "Missão",
      agente: p.agente as string,
      status: p.status as string,
      createdAt: p.created_at as string,
      erroResumo: erroPorStep.get(p.id as string) ?? null,
    };
    if (classe === "em_producao") emProducao.push(item);
    else comFalha.push(item);
  }

  return { emProducao, comFalha };
}
