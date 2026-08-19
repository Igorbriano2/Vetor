import { supabase } from "../db/supabase.js";

// Drive de ativos empresariais — o que o CLIENTE fornece como referência
// real (logo, fotos de produto, fotos de equipe, ambiente...), distinto de
// `artifacts` (o que o Vetor PRODUZ). Genérico por design: nenhum campo é
// específico de nicho — serve restaurante, advocacia, clínica, loja,
// indústria, o que for.

export type CategoriaAtivo =
  | "identidade_visual"
  | "produtos_servicos"
  | "pessoas_especialistas"
  | "ambientes_operacao"
  | "campanhas_referencias"
  | "documentos_contexto"
  | "outro";

export type StatusAtivo = "rascunho" | "aprovado" | "arquivado" | "rejeitado";

export type PapelUsoAtivo = "referencia" | "fonte" | "logo" | "template" | "fundo" | "produto" | "pessoa";

export interface AssetDisponivel {
  id: string;
  nome: string;
  url: string;
  tags: string[];
  categoria: CategoriaAtivo;
  descricao: string | null;
  isLogoPrincipal: boolean;
  storagePath: string;
  // Nulo quando o upload é antigo e nunca teve dimensão gravada — quem
  // consome (ex: design_projects.ts ao montar o canvasJson) precisa tratar
  // esse caso, nunca assumir um valor.
  width: number | null;
  height: number | null;
}

interface FiltroBuscaAtivos {
  termo?: string;
  categoria?: CategoriaAtivo;
  status?: StatusAtivo;
  limite?: number;
}

// Só ativos "aprovado" são elegíveis pra uso automático por um agente —
// rascunho/arquivado/rejeitado exigem ação humana antes (mesma lógica de
// "nunca usar arquivo rejeitado ou arquivado" do fluxo de Design).
const STATUS_ELEGIVEL_PARA_AGENTE: StatusAtivo = "aprovado";

async function assinarUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from("brand-assets").createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}

// Busca geral por nome/tag/descrição/categoria — usada tanto pelo contexto
// automático (Design/Vídeo) quanto pela tool buscar_ativos_negocio, que o
// LLM pode chamar explicitamente quando precisa de algo específico
// (ex: "foto do produto X", "foto da Dra. Fulana").
export async function buscarAtivos(clienteId: string, filtro: FiltroBuscaAtivos = {}): Promise<AssetDisponivel[]> {
  let query = supabase
    .from("business_assets")
    .select("id, nome, storage_path, tags, categoria, descricao, status, is_logo_principal, width, height")
    .eq("cliente_id", clienteId)
    .eq("status", filtro.status ?? STATUS_ELEGIVEL_PARA_AGENTE)
    .order("created_at", { ascending: false })
    .limit(filtro.limite ?? 10);

  if (filtro.categoria) query = query.eq("categoria", filtro.categoria);

  const { data } = await query;
  if (!data || data.length === 0) return [];

  const termo = filtro.termo?.toLowerCase().trim();
  const filtrados = termo
    ? data.filter((a) => {
        const tags = Array.isArray(a.tags) ? (a.tags as string[]) : [];
        return (
          (a.nome as string).toLowerCase().includes(termo) ||
          (a.descricao as string | null)?.toLowerCase().includes(termo) ||
          tags.some((t) => t.toLowerCase().includes(termo))
        );
      })
    : data;

  return Promise.all(
    filtrados.map(async (a) => ({
      id: a.id as string,
      nome: a.nome as string,
      url: (await assinarUrl(a.storage_path as string)) ?? "",
      tags: Array.isArray(a.tags) ? (a.tags as string[]) : [],
      categoria: a.categoria as CategoriaAtivo,
      descricao: a.descricao as string | null,
      isLogoPrincipal: a.is_logo_principal as boolean,
      storagePath: a.storage_path as string,
      width: (a.width as number | null) ?? null,
      height: (a.height as number | null) ?? null,
    })),
  ).then((assets) => assets.filter((a) => a.url));
}

// Contexto automático injetado no prompt do especialista (Design/Vídeo) —
// mantém compatibilidade com a assinatura antiga (limite simples), mas agora
// devolve os campos novos também.
export async function buscarAssetsRelevantes(clienteId: string, limite = 10): Promise<AssetDisponivel[]> {
  return buscarAtivos(clienteId, { limite });
}

interface VariantesDeLogo {
  logoPorFormato: Record<string, string>;
  principal: string | null;
  fundoClaro: string | null;
  fundoEscuro: string | null;
  monocromatica: string | null;
  simbolo: string | null;
}

// Pura, sem I/O — decide qual asset_id usar pro formato pedido, dada a
// preferência cadastrada em brand_kits.logo_por_formato. Sempre cai pra
// "principal" se a variante preferida não estiver definida (nunca fica sem
// logo só porque o cliente não configurou a preferência fina por formato).
export function resolverAssetIdDaLogo(formato: string, variantes: VariantesDeLogo): string | null {
  const mapaVariante: Record<string, string | null> = {
    principal: variantes.principal,
    fundo_claro: variantes.fundoClaro,
    fundo_escuro: variantes.fundoEscuro,
    monocromatica: variantes.monocromatica,
    simbolo: variantes.simbolo,
  };

  const variantePreferida = variantes.logoPorFormato[formato];
  return (variantePreferida && mapaVariante[variantePreferida]) || variantes.principal;
}

// A logo oficial pro formato pedido — consulta brand_kits.logo_por_formato +
// os campos *_asset_id. Nunca inventa logo: se não houver nada cadastrado,
// devolve null e quem chama decide o fallback (rascunho marcado "sem logo").
export async function buscarLogoParaFormato(
  clienteId: string,
  formato: "feed" | "story" | "avatar" | string,
): Promise<AssetDisponivel | null> {
  const { data: kit } = await supabase
    .from("brand_kits")
    .select(
      "logo_por_formato, logo_principal_asset_id, logo_fundo_claro_asset_id, logo_fundo_escuro_asset_id, logo_monocromatica_asset_id, simbolo_asset_id",
    )
    .eq("cliente_id", clienteId)
    .eq("is_atual", true)
    .maybeSingle();

  if (!kit) return null;

  const assetId = resolverAssetIdDaLogo(formato, {
    logoPorFormato: (kit.logo_por_formato as Record<string, string>) ?? {},
    principal: kit.logo_principal_asset_id as string | null,
    fundoClaro: kit.logo_fundo_claro_asset_id as string | null,
    fundoEscuro: kit.logo_fundo_escuro_asset_id as string | null,
    monocromatica: kit.logo_monocromatica_asset_id as string | null,
    simbolo: kit.simbolo_asset_id as string | null,
  });

  if (!assetId) return null;

  const { data: asset } = await supabase
    .from("business_assets")
    .select("id, nome, storage_path, tags, categoria, descricao, status, is_logo_principal, width, height")
    .eq("id", assetId as string)
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (!asset || asset.status !== "aprovado") return null;

  const url = await assinarUrl(asset.storage_path as string);
  if (!url) return null;

  return {
    id: asset.id as string,
    nome: asset.nome as string,
    url,
    tags: Array.isArray(asset.tags) ? (asset.tags as string[]) : [],
    categoria: asset.categoria as CategoriaAtivo,
    descricao: asset.descricao as string | null,
    isLogoPrincipal: asset.is_logo_principal as boolean,
    storagePath: asset.storage_path as string,
    width: (asset.width as number | null) ?? null,
    height: (asset.height as number | null) ?? null,
  };
}

export interface RegistroDeUso {
  clienteId: string;
  assetId: string;
  missionId?: string;
  missionStepId?: string;
  artifactId?: string;
  agente: string;
  papel: PapelUsoAtivo;
  motivo?: string;
}

// Nunca "usei tal imagem" só na prosa do summary — todo uso real de ativo
// numa geração fica registrado aqui (auditável, consultável por campanha).
export async function registrarUsoDeAtivo(registro: RegistroDeUso): Promise<void> {
  await supabase.from("business_asset_usage").insert({
    cliente_id: registro.clienteId,
    asset_id: registro.assetId,
    mission_id: registro.missionId ?? null,
    mission_step_id: registro.missionStepId ?? null,
    artifact_id: registro.artifactId ?? null,
    agente: registro.agente,
    papel: registro.papel,
    motivo: registro.motivo ?? null,
  });
}

// Baixa os bytes reais de um ativo (pro fluxo image-to-image — nunca
// composição fake, o arquivo de verdade vai pro provider).
export async function baixarBytesDoAtivo(assetId: string): Promise<Buffer | null> {
  const { data: asset } = await supabase.from("business_assets").select("storage_path").eq("id", assetId).maybeSingle();
  if (!asset) return null;

  const { data, error } = await supabase.storage.from("brand-assets").download(asset.storage_path as string);
  if (error || !data) return null;

  return Buffer.from(await data.arrayBuffer());
}

// Confere se um asset pertence ao cliente E está num status elegível pra
// uso automático — usado antes de qualquer geração que referencie um
// assetId vindo do LLM (nunca confia cegamente no id que o modelo citou).
export async function validarAtivoParaUso(
  clienteId: string,
  assetId: string,
): Promise<{ valido: boolean; motivo?: string }> {
  const { data } = await supabase
    .from("business_assets")
    .select("cliente_id, status")
    .eq("id", assetId)
    .maybeSingle();

  if (!data) return { valido: false, motivo: "Ativo não encontrado." };
  if (data.cliente_id !== clienteId) return { valido: false, motivo: "Ativo pertence a outro cliente." };
  if (data.status !== "aprovado") return { valido: false, motivo: `Ativo está com status "${data.status}", não pode ser usado.` };

  return { valido: true };
}

export interface AtivoComMime {
  id: string;
  storagePath: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}

// Busca um único ativo pelo id — chame validarAtivoParaUso() antes pra
// checar tenant/status; esta função só resolve os dados pra usar depois
// da validação passar (mantém as duas responsabilidades separadas, igual
// o resto do arquivo já faz).
export async function buscarAtivoPorId(assetId: string): Promise<AtivoComMime | null> {
  const { data } = await supabase
    .from("business_assets")
    .select("id, storage_path, mime_type, width, height")
    .eq("id", assetId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    storagePath: data.storage_path as string,
    mimeType: data.mime_type as string | null,
    width: (data.width as number | null) ?? null,
    height: (data.height as number | null) ?? null,
  };
}
