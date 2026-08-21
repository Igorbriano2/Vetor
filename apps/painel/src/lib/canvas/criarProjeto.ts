import type { SupabaseClient } from "@supabase/supabase-js";
import { grafoVazio } from "./types";

// Extraído de NovoProjetoCanvasBotao.tsx (Fase 3 do Vetor Manager V2) pra
// ser reaproveitado também pelo modal "Novo projeto" da galeria de Criações
// (Design V2 Fase 2) — mesma criação, dois pontos de entrada.
export async function criarProjetoCanvas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  clienteId: string,
  titulo = "Novo projeto de canvas",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("creative_canvas_projects")
    .insert({ cliente_id: clienteId, title: titulo, graph_json: grafoVazio() })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}
