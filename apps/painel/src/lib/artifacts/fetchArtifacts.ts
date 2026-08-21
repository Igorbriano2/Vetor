import type { SupabaseClient } from "@supabase/supabase-js";

// Busca artefatos reais (tabela artifacts, ver supabase/migrations/0015) já
// com URL resolvida (assinada pro bucket próprio, direta pra CDN externa
// tipo Higgsfield) — usado por Design/Videomaker/Entregas, que são todas
// "biblioteca filtrada por departamento" no fundo.
export interface ArtefatoBiblioteca {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  department: string;
  missionId: string | null;
  missionTitulo: string | null;
  url: string | null;
  content: string | null;
  createdAt: string;
  // Fase 2 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — quando o
  // artefato tem um design_project real vinculado (design_projects.artifact_id),
  // o card pode oferecer "Editar" apontando pro editor de verdade. Nulo é o
  // caso comum (nem todo artefato é uma peça de Design editável).
  designProjectId: string | null;
}

export async function buscarArtefatos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  opcoes: { departamentos?: string[]; clienteId?: string } = {},
): Promise<ArtefatoBiblioteca[]> {
  let query = supabase
    .from("artifacts")
    .select("id, type, title, description, status, department, mission_id, storage_provider, storage_path, metadata, created_at, missions(titulo)")
    .order("created_at", { ascending: false });

  if (opcoes.departamentos?.length) {
    query = query.in("department", opcoes.departamentos);
  }
  // Fase 8 do reset de produto — filtro explícito, não só RLS implícito
  // (admin_vetor passa por toda policy, sem isso a lista mistura qualquer
  // cliente quando o workspace switcher existe, ver resolverClienteAtivo.ts).
  if (opcoes.clienteId) {
    query = query.eq("cliente_id", opcoes.clienteId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Fase 2 do Vetor Manager UX — resolve design_project_id em lote (uma
  // query só, nunca N+1) pra habilitar a ação "Editar" nos cards que têm um
  // projeto de Design real por trás. Múltiplas versões podem existir com o
  // mesmo artifact_id (parent_design_project_id) — pega a mais recente.
  const idsDeArtefato = data.map((a) => a.id as string);
  const designProjectPorArtefato = new Map<string, string>();
  if (idsDeArtefato.length > 0) {
    const { data: projetos } = await supabase
      .from("design_projects")
      .select("id, artifact_id, version")
      .in("artifact_id", idsDeArtefato)
      .order("version", { ascending: false });
    for (const p of projetos ?? []) {
      const artifactId = p.artifact_id as string;
      if (!designProjectPorArtefato.has(artifactId)) designProjectPorArtefato.set(artifactId, p.id as string);
    }
  }

  return Promise.all(
    data.map(async (a) => {
      let url: string | null = null;
      if (a.storage_provider === "external") {
        url = a.storage_path as string | null;
      } else if (a.storage_provider === "supabase" && a.storage_path) {
        const { data: signed } = await supabase.storage.from("artifacts").createSignedUrl(a.storage_path as string, 60 * 60);
        url = signed?.signedUrl ?? null;
      }
      return {
        id: a.id as string,
        type: a.type as string,
        title: a.title as string,
        description: a.description as string | null,
        status: a.status as string,
        department: a.department as string,
        missionId: a.mission_id as string | null,
        missionTitulo: (a.missions as unknown as { titulo?: string } | null)?.titulo ?? null,
        url,
        content: (a.metadata as { content?: string } | null)?.content ?? null,
        createdAt: a.created_at as string,
        designProjectId: designProjectPorArtefato.get(a.id as string) ?? null,
      };
    }),
  );
}

// video_projects não grava linha em `artifacts` (o projeto em si É a
// entrega — ver criaArtefatoGenerico em specialistRunner.ts), então sem
// isso um vídeo finalizado (final_render real) nunca aparecia em Entregas
// — achado real na prova do Videomaker Fase 2. Só entra aqui quando o
// render final já rodou de verdade (output_storage_path real), nunca um
// projeto ainda em edição.
export async function buscarVideosFinalizados(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<ArtefatoBiblioteca[]> {
  const { data, error } = await supabase
    .from("video_projects")
    .select("id, title, status, mission_id, output_storage_path, created_at, missions(titulo)")
    .eq("status", "completed")
    .not("output_storage_path", "is", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return Promise.all(
    data.map(async (v) => {
      const { data: signed } = await supabase.storage.from("artifacts").createSignedUrl(v.output_storage_path as string, 60 * 60);
      return {
        id: v.id as string,
        type: "video",
        title: v.title as string,
        description: null,
        status: v.status as string,
        department: "videomaker",
        missionId: v.mission_id as string | null,
        missionTitulo: (v.missions as unknown as { titulo?: string } | null)?.titulo ?? null,
        url: signed?.signedUrl ?? null,
        content: null,
        createdAt: v.created_at as string,
        designProjectId: null,
      };
    }),
  );
}
