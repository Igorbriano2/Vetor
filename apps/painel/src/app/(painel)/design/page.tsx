import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import DesignCommandCenter from "./DesignCommandCenter";

// Fase 1 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — /design deixa de
// ser um inventário de projetos técnicos e vira o departamento de criação:
// entrada por intenção (nova peça/referência/template/campanha), trabalho em
// andamento, campanhas e biblioteca visual na primeira dobra. Nenhum caminho
// de criação novo — o wizard só monta um PlanoConfirmado e reusa
// criarMissaoDeIntencao via /api/missoes, igual ao VetorIntentCard.
export default async function DesignPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);
  const clienteId = ativo.clienteId ?? undefined;

  if (!clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }

  const [
    artefatos,
    { data: projetos },
    { data: etapasEmAndamento },
    { data: brandKit },
    { data: referenciasPreview },
    { data: assetsDrive },
  ] = await Promise.all([
    buscarArtefatos(supabase, { departamentos: ["design"], clienteId }),
    supabase
      .from("design_projects")
      .select("id, title, version, status, thumbnail_url, updated_at, mission_id, missions(titulo)")
      .eq("cliente_id", clienteId)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("mission_steps")
      .select("id, tarefa, status, mission_id, missions(titulo)")
      .eq("cliente_id", clienteId)
      .eq("agente", "design")
      .in("status", ["running", "awaiting_approval", "ready"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("brand_kits").select("id").eq("cliente_id", clienteId).eq("is_atual", true).maybeSingle(),
    supabase
      .from("reference_library_items")
      .select("id, title, description, source_type")
      .or(`cliente_id.eq.${clienteId},cliente_id.is.null`)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("business_assets")
      .select("id, nome")
      .eq("cliente_id", clienteId)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  // "Minhas campanhas": missões distintas que já têm pelo menos uma etapa de
  // Design — sem tabela nova, mission_steps continua a única fonte de
  // verdade (ver docs/PRODUCT-RESET-AUDIT.md, seção "o que não pode quebrar").
  const { data: todasEtapasDesign } = await supabase
    .from("mission_steps")
    .select("mission_id, status")
    .eq("cliente_id", clienteId)
    .eq("agente", "design");

  const missionIdsComDesign = Array.from(new Set((todasEtapasDesign ?? []).map((e) => e.mission_id as string)));
  const contagemPorMissao = new Map<string, { total: number; aprovacao: number; concluidas: number }>();
  for (const e of todasEtapasDesign ?? []) {
    const missionId = e.mission_id as string;
    const atual = contagemPorMissao.get(missionId) ?? { total: 0, aprovacao: 0, concluidas: 0 };
    atual.total += 1;
    if (e.status === "awaiting_approval") atual.aprovacao += 1;
    if (e.status === "completed" || e.status === "completed_with_caveats") atual.concluidas += 1;
    contagemPorMissao.set(missionId, atual);
  }

  const { data: campanhasBrutas } = missionIdsComDesign.length
    ? await supabase
        .from("missions")
        .select("id, titulo, status, created_at")
        .in("id", missionIdsComDesign)
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
    <DesignCommandCenter
      temBrandKit={!!brandKit}
      etapasEmAndamento={(etapasEmAndamento ?? []).map((e) => ({
        id: e.id as string,
        tarefa: e.tarefa as string,
        status: e.status as string,
        missionId: e.mission_id as string,
        missionTitulo: (e.missions as unknown as { titulo?: string } | null)?.titulo ?? "Missão",
      }))}
      campanhas={campanhas}
      projetos={(projetos ?? []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        version: p.version as number,
        status: p.status as string,
        thumbnailUrl: p.thumbnail_url as string | null,
        missionId: p.mission_id as string | null,
        missionTitulo: (p.missions as unknown as { titulo?: string } | null)?.titulo ?? null,
      }))}
      artefatos={artefatos}
      referencias={(referenciasPreview ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        description: r.description as string | null,
        sourceType: r.source_type as string,
      }))}
      assetsDrive={(assetsDrive ?? []).map((a) => ({ id: a.id as string, nome: a.nome as string }))}
    />
  );
}
