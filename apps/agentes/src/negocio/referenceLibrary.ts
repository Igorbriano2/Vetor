import { supabase } from "../db/supabase.js";

// Biblioteca de Referências (Fase 1 do upgrade inspirado no Gravyx, ver
// docs/GRAVYX-UPGRADE-AUDIT.md) — catálogo de itens de referência visual/de
// estilo que o cliente reúne ANTES de pedir uma peça: upload próprio (via
// Drive/business_assets, nunca duplicando storage), URL externa colada pelo
// cliente (nunca scraping automático) ou item curado pelo time Vetor
// (clienteId nulo, visível a todos os tenants). Distinto de business_assets
// (matéria-prima literal pra compor uma peça) e de reference_video_profiles
// (perfil de estilo já extraído — Fase 3 generaliza esse fluxo pra aceitar
// itens daqui como origem, não é o que este arquivo faz).

export type OrigemReferencia = "upload" | "external_url" | "curated";
export type StatusReferencia = "ativo" | "arquivado";

export interface ItemReferencia {
  id: string;
  clienteId: string | null;
  sourceType: OrigemReferencia;
  assetId: string | null;
  externalUrl: string | null;
  title: string;
  description: string | null;
  tags: string[];
  department: string | null;
  direitosUso: string | null;
  status: StatusReferencia;
  createdAt: string;
}

function mapearLinha(row: Record<string, unknown>): ItemReferencia {
  return {
    id: row.id as string,
    clienteId: (row.cliente_id as string | null) ?? null,
    sourceType: row.source_type as OrigemReferencia,
    assetId: (row.asset_id as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    department: (row.department as string | null) ?? null,
    direitosUso: (row.direitos_uso as string | null) ?? null,
    status: row.status as StatusReferencia,
    createdAt: row.created_at as string,
  };
}

const COLUNAS =
  "id, cliente_id, source_type, asset_id, external_url, title, description, tags, department, direitos_uso, status, created_at";

interface FiltroReferencias {
  termo?: string;
  department?: string;
  tag?: string;
  incluirArquivadas?: boolean;
  limite?: number;
}

// Lista referências visíveis pro cliente — as próprias (cliente_id = si
// mesmo) MAIS as curadas pelo time Vetor (cliente_id nulo), nunca as de
// outro tenant. A RLS já garante isso a nível de banco (ver migration
// 0029_reference_library.sql); o filtro aqui é só conveniência de busca.
export async function listarReferencias(clienteId: string, filtro: FiltroReferencias = {}): Promise<ItemReferencia[]> {
  let query = supabase
    .from("reference_library_items")
    .select(COLUNAS)
    .or(`cliente_id.eq.${clienteId},cliente_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(filtro.limite ?? 30);

  if (!filtro.incluirArquivadas) query = query.eq("status", "ativo");
  if (filtro.department) query = query.eq("department", filtro.department);
  if (filtro.tag) query = query.contains("tags", [filtro.tag]);

  const { data } = await query;
  if (!data) return [];

  const termo = filtro.termo?.toLowerCase().trim();
  const linhas = termo
    ? data.filter((r) => {
        const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
        return (
          (r.title as string).toLowerCase().includes(termo) ||
          (r.description as string | null)?.toLowerCase().includes(termo) ||
          tags.some((t) => t.toLowerCase().includes(termo))
        );
      })
    : data;

  return linhas.map(mapearLinha);
}

export interface NovaReferenciaPorUpload {
  clienteId: string;
  assetId: string;
  title: string;
  description?: string;
  tags?: string[];
  department?: string;
  direitosUso?: string;
  createdBy?: string;
}

// Cria uma referência a partir de um ativo JÁ existente no Drive — nunca
// duplica o arquivo, só aponta pra ele. Valida que o asset pertence ao
// mesmo cliente antes de vincular (nunca confia num assetId vindo do LLM
// sem checar, mesmo padrão de validarAtivoParaUso em businessAssets.ts).
export async function criarReferenciaPorUpload(dados: NovaReferenciaPorUpload): Promise<ItemReferencia | null> {
  const { data: asset } = await supabase
    .from("business_assets")
    .select("id, cliente_id")
    .eq("id", dados.assetId)
    .maybeSingle();
  if (!asset || asset.cliente_id !== dados.clienteId) return null;

  const { data, error } = await supabase
    .from("reference_library_items")
    .insert({
      cliente_id: dados.clienteId,
      source_type: "upload",
      asset_id: dados.assetId,
      title: dados.title,
      description: dados.description ?? null,
      tags: dados.tags ?? [],
      department: dados.department ?? null,
      direitos_uso: dados.direitosUso ?? null,
      created_by: dados.createdBy ?? null,
    })
    .select(COLUNAS)
    .single();

  if (error || !data) return null;
  return mapearLinha(data);
}

export interface NovaReferenciaPorUrl {
  clienteId: string;
  externalUrl: string;
  title: string;
  description?: string;
  tags?: string[];
  department?: string;
  direitosUso?: string;
  createdBy?: string;
}

// Cria uma referência a partir de uma URL que o cliente colou — nunca
// baixa/raspa o conteúdo da URL (proibido pelo prompt mestre do upgrade),
// só grava o link real informado.
export async function criarReferenciaPorUrl(dados: NovaReferenciaPorUrl): Promise<ItemReferencia | null> {
  const { data, error } = await supabase
    .from("reference_library_items")
    .insert({
      cliente_id: dados.clienteId,
      source_type: "external_url",
      external_url: dados.externalUrl,
      title: dados.title,
      description: dados.description ?? null,
      tags: dados.tags ?? [],
      department: dados.department ?? null,
      direitos_uso: dados.direitosUso ?? null,
      created_by: dados.createdBy ?? null,
    })
    .select(COLUNAS)
    .single();

  if (error || !data) return null;
  return mapearLinha(data);
}

// Nunca deleta fisicamente (histórico/auditoria) — arquivar é o caminho
// normal, mesmo padrão de status usado em business_assets.
export async function arquivarReferencia(id: string, clienteId: string): Promise<boolean> {
  const { error } = await supabase
    .from("reference_library_items")
    .update({ status: "arquivado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("cliente_id", clienteId);
  return !error;
}

export interface Colecao {
  id: string;
  clienteId: string;
  nome: string;
  descricao: string | null;
  createdAt: string;
}

export async function listarColecoes(clienteId: string): Promise<Colecao[]> {
  const { data } = await supabase
    .from("reference_collections")
    .select("id, cliente_id, nome, descricao, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    clienteId: r.cliente_id as string,
    nome: r.nome as string,
    descricao: (r.descricao as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function criarColecao(clienteId: string, nome: string, descricao?: string, createdBy?: string): Promise<Colecao | null> {
  const { data, error } = await supabase
    .from("reference_collections")
    .insert({ cliente_id: clienteId, nome, descricao: descricao ?? null, created_by: createdBy ?? null })
    .select("id, cliente_id, nome, descricao, created_at")
    .single();

  if (error || !data) return null;
  return {
    id: data.id as string,
    clienteId: data.cliente_id as string,
    nome: data.nome as string,
    descricao: (data.descricao as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

// Adiciona um item (próprio ou curado) numa coleção do cliente — valida que
// a coleção pertence ao cliente antes de gravar (nunca confia num
// collectionId vindo de fora sem checar o dono).
export async function adicionarNaColecao(
  clienteId: string,
  collectionId: string,
  referenceLibraryItemId: string,
  addedBy?: string,
): Promise<boolean> {
  const { data: colecao } = await supabase
    .from("reference_collections")
    .select("id, cliente_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (!colecao || colecao.cliente_id !== clienteId) return false;

  const { error } = await supabase.from("reference_collection_items").insert({
    collection_id: collectionId,
    reference_library_item_id: referenceLibraryItemId,
    cliente_id: clienteId,
    added_by: addedBy ?? null,
  });
  // Conflito de unique (item já está na coleção) não é erro real pra quem
  // chama — o resultado desejado (item na coleção) já está satisfeito.
  return !error || error.code === "23505";
}

export async function listarItensDaColecao(clienteId: string, collectionId: string): Promise<ItemReferencia[]> {
  const { data } = await supabase
    .from("reference_collection_items")
    .select(`reference_library_items (${COLUNAS})`)
    .eq("cliente_id", clienteId)
    .eq("collection_id", collectionId);

  if (!data) return [];
  return data
    .map((r) => r.reference_library_items as unknown as Record<string, unknown> | null)
    .filter((item): item is Record<string, unknown> => !!item)
    .map(mapearLinha);
}
