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
}

export async function buscarArtefatos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  opcoes: { departamentos?: string[] } = {},
): Promise<ArtefatoBiblioteca[]> {
  let query = supabase
    .from("artifacts")
    .select("id, type, title, description, status, department, mission_id, storage_provider, storage_path, metadata, created_at, missions(titulo)")
    .order("created_at", { ascending: false });

  if (opcoes.departamentos?.length) {
    query = query.in("department", opcoes.departamentos);
  }

  const { data, error } = await query;
  if (error || !data) return [];

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
      };
    }),
  );
}
