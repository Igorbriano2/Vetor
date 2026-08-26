import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import SocialCommandCenter from "./SocialCommandCenter";

// Navegação por especialista — Social ganha área própria (mesmo nível de
// recurso que Design/Estratégia): trabalho em andamento do agente
// `social-media`, copies/legendas já entregues (artifacts department=
// "conteudo", mesmo filtro que Entregas já usa) e o calendário editorial
// (continua também em /planejamento — Planejamento não fica vazio sem ele,
// então não faz sentido remover de lá; aqui é conveniência de quem trabalha
// o dia a dia de conteúdo social).
export default async function SocialPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [{ data: etapasEmAndamento }, { data: todasEtapasSocial }, copies] = await Promise.all([
    supabase
      .from("mission_steps")
      .select("id, tarefa, status, mission_id, missions(titulo)")
      .eq("cliente_id", clienteId)
      .eq("agente", "social-media")
      .in("status", ["running", "awaiting_approval", "ready"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("mission_steps").select("mission_id, status").eq("cliente_id", clienteId).eq("agente", "social-media"),
    buscarArtefatos(supabase, { departamentos: ["conteudo"], clienteId }),
  ]);

  const missionIdsComSocial = Array.from(new Set((todasEtapasSocial ?? []).map((e) => e.mission_id as string)));
  const contagemPorMissao = new Map<string, { total: number; aprovacao: number; concluidas: number }>();
  for (const e of todasEtapasSocial ?? []) {
    const missionId = e.mission_id as string;
    const atual = contagemPorMissao.get(missionId) ?? { total: 0, aprovacao: 0, concluidas: 0 };
    atual.total += 1;
    if (e.status === "awaiting_approval") atual.aprovacao += 1;
    if (e.status === "completed" || e.status === "completed_with_caveats") atual.concluidas += 1;
    contagemPorMissao.set(missionId, atual);
  }

  const { data: campanhasBrutas } = missionIdsComSocial.length
    ? await supabase
        .from("missions")
        .select("id, titulo, status, created_at")
        .in("id", missionIdsComSocial)
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  const campanhas = (campanhasBrutas ?? []).map((m) => ({
    id: m.id as string,
    titulo: m.titulo as string,
    status: m.status as string,
    contagem: contagemPorMissao.get(m.id as string) ?? { total: 0, aprovacao: 0, concluidas: 0 },
  }));

  return (
    <SocialCommandCenter
      clienteId={clienteId}
      etapasEmAndamento={(etapasEmAndamento ?? []).map((e) => ({
        id: e.id as string,
        tarefa: e.tarefa as string,
        status: e.status as string,
        missionId: e.mission_id as string,
        missionTitulo: (e.missions as unknown as { titulo?: string } | null)?.titulo ?? "Missão",
      }))}
      campanhas={campanhas}
      copies={copies.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        missionId: c.missionId,
        missionTitulo: c.missionTitulo,
        createdAt: c.createdAt,
      }))}
    />
  );
}
