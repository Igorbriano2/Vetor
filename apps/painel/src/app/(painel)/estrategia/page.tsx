import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import type { RotaEstrategica } from "../planejamento/rotaEstrategicaTipos";
import EstrategiaCommandCenter from "./EstrategiaCommandCenter";
import type { PlanoMensal } from "./PlanosMensais";

// Navegação por especialista — Estratégia ganha área própria (mesmo nível de
// recurso que Design já tem): trabalho em andamento do agente `estrategia`,
// hipóteses por trás de cada missão (movido de /planejamento) e as Rotas
// Estratégicas já entregues (artifacts type=plan, metadata.formato=
// rota_estrategica — mesmo filtro que /planejamento já usava pra decidir
// quando renderizar RotaEstrategicaView).
//
// Reorganização de menus — /planejamento inteiro foi absorvido aqui (virou
// redirect): os dois eram a mesma coisa de fundo (artifacts type=plan
// gerados pelo agente estratégia), só com apresentação separada. "planos"
// abaixo é o que sobra de type=plan quando não é uma rota estratégica —
// planos mensais com calendário/indicadores, de onde nasce "gerar peças".
export default async function EstrategiaPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [{ data: etapasEmAndamento }, { data: todasEtapasEstrategia }, { data: missoes }, { data: planos }] = await Promise.all([
    supabase
      .from("mission_steps")
      .select("id, tarefa, status, mission_id, missions(titulo)")
      .eq("cliente_id", clienteId)
      .eq("agente", "estrategia")
      .in("status", ["running", "awaiting_approval", "ready"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("mission_steps").select("mission_id, status").eq("cliente_id", clienteId).eq("agente", "estrategia"),
    supabase
      .from("missions")
      .select("id, titulo, objetivo, hipotese, criterio_sucesso, status, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("artifacts")
      .select("id, title, mission_id, metadata, created_at")
      .eq("type", "plan")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),
  ]);

  const missionIdsComEstrategia = Array.from(new Set((todasEtapasEstrategia ?? []).map((e) => e.mission_id as string)));
  const contagemPorMissao = new Map<string, { total: number; aprovacao: number; concluidas: number }>();
  for (const e of todasEtapasEstrategia ?? []) {
    const missionId = e.mission_id as string;
    const atual = contagemPorMissao.get(missionId) ?? { total: 0, aprovacao: 0, concluidas: 0 };
    atual.total += 1;
    if (e.status === "awaiting_approval") atual.aprovacao += 1;
    if (e.status === "completed" || e.status === "completed_with_caveats") atual.concluidas += 1;
    contagemPorMissao.set(missionId, atual);
  }

  const { data: campanhasBrutas } = missionIdsComEstrategia.length
    ? await supabase
        .from("missions")
        .select("id, titulo, status, created_at")
        .in("id", missionIdsComEstrategia)
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  const campanhas = (campanhasBrutas ?? []).map((m) => ({
    id: m.id as string,
    titulo: m.titulo as string,
    status: m.status as string,
    contagem: contagemPorMissao.get(m.id as string) ?? { total: 0, aprovacao: 0, concluidas: 0 },
  }));

  const comHipotese = (missoes ?? []).filter((m) => m.hipotese);

  const rotas = (planos ?? [])
    .map((p) => {
      const meta = (p.metadata as { formato?: string; rota?: RotaEstrategica } | null) ?? {};
      if (meta.formato !== "rota_estrategica" || !meta.rota) return null;
      return {
        id: p.id as string,
        titulo: p.title as string,
        missionId: p.mission_id as string | null,
        createdAt: p.created_at as string,
        rota: meta.rota,
      };
    })
    .filter((r): r is { id: string; titulo: string; missionId: string | null; createdAt: string; rota: RotaEstrategica } => r !== null);

  const planosMensais = (planos ?? [])
    .filter((p) => {
      const meta = (p.metadata as { formato?: string } | null) ?? {};
      return meta.formato !== "rota_estrategica";
    })
    .map((p) => ({
      id: p.id as string,
      title: p.title as string,
      mission_id: p.mission_id as string | null,
      created_at: p.created_at as string,
      metadata: p.metadata as PlanoMensal["metadata"],
    }));

  return (
    <EstrategiaCommandCenter
      etapasEmAndamento={(etapasEmAndamento ?? []).map((e) => ({
        id: e.id as string,
        tarefa: e.tarefa as string,
        status: e.status as string,
        missionId: e.mission_id as string,
        missionTitulo: (e.missions as unknown as { titulo?: string } | null)?.titulo ?? "Missão",
      }))}
      campanhas={campanhas}
      hipoteses={comHipotese.map((m) => ({
        id: m.id as string,
        titulo: m.titulo as string,
        hipotese: m.hipotese as string,
        criterioSucesso: (m.criterio_sucesso as string[] | null) ?? [],
      }))}
      rotas={rotas}
      planosMensais={planosMensais}
    />
  );
}
