import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import AnaliticoView from "./AnaliticoView";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function cortede7Dias(): string {
  return new Date(Date.now() - SETE_DIAS_MS).toISOString();
}

// Navegação por especialista — Analítico consolida num lugar só o que hoje
// vive espalhado: métricas de tráfego (campanhas_trafego), volume de
// criações por frente (artifacts.department), missões por status/agente e
// custo real de operação (agent_runs.custo_estimado_centavos, já populado
// de verdade — não é gap, ver apps/agentes/src/billing/agentRunCost.ts).
// /insights e /dashboard continuam redirect pra /vetor (decisão anterior,
// nenhuma das duas tinha conteúdo real — não há nada pra consolidar delas).
export default async function AnaliticoPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [
    { data: campanhasTrafego },
    { data: conexaoMeta },
    { data: artefatos },
    { count: criacoes7dias },
    { data: missoes },
    { data: etapas },
    { data: agentRuns },
  ] = await Promise.all([
    supabase.from("campanhas_trafego").select("id, metricas, status").eq("cliente_id", clienteId),
    supabase.from("connections").select("status").eq("cliente_id", clienteId).eq("provider", "meta_ads").eq("status", "connected").maybeSingle(),
    supabase.from("artifacts").select("id, department, type").eq("cliente_id", clienteId),
    supabase
      .from("artifacts")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .gte("created_at", cortede7Dias()),
    supabase.from("missions").select("id, status, created_at").eq("cliente_id", clienteId),
    supabase.from("mission_steps").select("id, agente, status").eq("cliente_id", clienteId),
    supabase
      .from("agent_runs")
      .select("agente, modelo, custo_estimado_centavos, custo_motivo_ausencia, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const metricasTrafego = (campanhasTrafego ?? []).reduce(
    (acc, c) => {
      const m = (c.metricas as Record<string, unknown> | null) ?? {};
      acc.spend += Number(m.spend ?? 0);
      acc.impressions += Number(m.impressions ?? 0);
      acc.clicks += Number(m.clicks ?? 0);
      acc.compras += Number(m.compras ?? 0);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, compras: 0 },
  );

  const criacoesPorDepartamento = new Map<string, number>();
  for (const a of artefatos ?? []) {
    const dep = (a.department as string) || "outro";
    criacoesPorDepartamento.set(dep, (criacoesPorDepartamento.get(dep) ?? 0) + 1);
  }

  const missoesPorStatus = new Map<string, number>();
  for (const m of missoes ?? []) {
    const s = m.status as string;
    missoesPorStatus.set(s, (missoesPorStatus.get(s) ?? 0) + 1);
  }

  const etapasPorAgente = new Map<string, { total: number; concluidas: number; aprovacao: number }>();
  for (const e of etapas ?? []) {
    const agente = e.agente as string;
    const atual = etapasPorAgente.get(agente) ?? { total: 0, concluidas: 0, aprovacao: 0 };
    atual.total += 1;
    if (e.status === "completed" || e.status === "completed_with_caveats") atual.concluidas += 1;
    if (e.status === "awaiting_approval") atual.aprovacao += 1;
    etapasPorAgente.set(agente, atual);
  }

  const custoPorAgente = new Map<string, number>();
  let custoTotalCentavos = 0;
  let chamadasSemCusto = 0;
  for (const r of agentRuns ?? []) {
    const agente = r.agente as string;
    const custo = r.custo_estimado_centavos as number | null;
    if (custo == null) {
      chamadasSemCusto += 1;
      continue;
    }
    custoPorAgente.set(agente, (custoPorAgente.get(agente) ?? 0) + custo);
    custoTotalCentavos += custo;
  }

  return (
    <AnaliticoView
      trafego={{ ...metricasTrafego, contaConectada: !!conexaoMeta }}
      criacoes7dias={criacoes7dias ?? 0}
      criacoesPorDepartamento={Array.from(criacoesPorDepartamento.entries()).map(([departamento, total]) => ({ departamento, total }))}
      missoesPorStatus={Array.from(missoesPorStatus.entries()).map(([status, total]) => ({ status, total }))}
      etapasPorAgente={Array.from(etapasPorAgente.entries()).map(([agente, contagem]) => ({ agente, ...contagem }))}
      custoTotalCentavos={custoTotalCentavos}
      custoPorAgente={Array.from(custoPorAgente.entries()).map(([agente, centavos]) => ({ agente, centavos }))}
      chamadasSemCusto={chamadasSemCusto}
      totalChamadas={(agentRuns ?? []).length}
    />
  );
}
