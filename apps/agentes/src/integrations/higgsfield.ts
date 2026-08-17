// Higgsfield — geração de imagem e vídeo, pros agentes de Design e Vídeo.
// Contrato confirmado em docs.higgsfield.ai: request assíncrono (POST no
// endpoint do modelo -> {status, request_id, status_url}) + polling em
// GET /requests/{id}/status até completed/failed/nsfw/canceled.
//
// Endpoint de vídeo/imagem configuráveis por env (HIGGSFIELD_ENDPOINT_PATH /
// HIGGSFIELD_IMAGE_ENDPOINT_PATH) — a doc pública só documenta um exemplo
// completo por tipo, então isso pode precisar ajuste sem mexer em código,
// caso o path real usado pela conta do cliente seja outro.

export class VideoIndisponivelError extends Error {}
export class ImagemIndisponivelError extends Error {}

export interface MidiaGerada {
  url: string;
  requestId: string;
}

function credenciais(): { keyId: string; keySecret: string } {
  const keyId = process.env.HIGGSFIELD_API_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("HIGGSFIELD_API_KEY_ID/HIGGSFIELD_API_KEY_SECRET não configurados.");
  }
  return { keyId, keySecret };
}

function baseUrl(): string {
  return process.env.HIGGSFIELD_BASE_URL ?? "https://platform.higgsfield.ai";
}

interface RespostaInicial {
  status: "queued" | "processing" | "completed" | "failed";
  request_id: string;
  status_url?: string;
}

interface RespostaStatus {
  status: "queued" | "processing" | "completed" | "failed" | "nsfw" | "canceled";
  request_id: string;
  error?: string;
  videos?: Array<{ url: string }>;
  images?: Array<{ url: string }>;
  output?: { url?: string } | string;
}

function extrairUrl(dados: RespostaStatus): MidiaGerada {
  const url =
    dados.videos?.[0]?.url ??
    dados.images?.[0]?.url ??
    (typeof dados.output === "string" ? dados.output : dados.output?.url);
  if (!url) throw new Error("Higgsfield retornou completed sem URL de mídia reconhecível.");
  return { url, requestId: dados.request_id };
}

// Núcleo do ciclo de vida assíncrono da Higgsfield — compartilhado por
// geração de imagem e vídeo, único lugar que sabe fazer polling (intervalo
// crescente 2s -> 10s com jitter, mesma estratégia recomendada na doc).
async function executarJobHiggsfield(
  endpointPath: string,
  corpo: Record<string, unknown>,
  timeoutMs: number,
): Promise<MidiaGerada> {
  const { keyId, keySecret } = credenciais();
  const authHeader = `Key ${keyId}:${keySecret}`;

  const resInicial = await fetch(`${baseUrl()}${endpointPath}`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resInicial.ok) {
    const texto = await resInicial.text();
    throw new Error(`Falha ao iniciar geração (Higgsfield ${endpointPath}, ${resInicial.status}): ${texto}`);
  }
  const inicial = (await resInicial.json()) as RespostaInicial;

  if (inicial.status === "completed") {
    return extrairUrl(inicial as unknown as RespostaStatus);
  }

  const statusUrl = inicial.status_url ?? `${baseUrl()}/requests/${inicial.request_id}/status`;
  const inicioEm = Date.now();
  let intervaloMs = 2000;

  while (Date.now() - inicioEm < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervaloMs + Math.random() * 500));
    intervaloMs = Math.min(intervaloMs * 1.5, 10_000);

    const resStatus = await fetch(statusUrl, { headers: { Authorization: authHeader, Accept: "application/json" } });
    if (!resStatus.ok) continue;
    const dados = (await resStatus.json()) as RespostaStatus;

    if (dados.status === "completed") return extrairUrl(dados);
    if (dados.status === "failed" || dados.status === "nsfw" || dados.status === "canceled") {
      throw new Error(`Geração terminou como "${dados.status}": ${dados.error ?? "sem detalhe"}`);
    }
  }

  throw new Error(`Timeout esperando geração (request_id: ${inicial.request_id})`);
}

// Gera um vídeo a partir de uma imagem + descrição de movimento (Agente de
// Vídeo).
export async function gerarVideoAPartirDeImagem(
  imagemUrl: string,
  prompt: string,
  opcoes: { timeoutMs?: number } = {},
): Promise<MidiaGerada> {
  try {
    const endpointPath = process.env.HIGGSFIELD_ENDPOINT_PATH ?? "/higgsfield-ai/dop/standard";
    const modelId = process.env.HIGGSFIELD_MODEL_ID;
    const corpo: Record<string, unknown> = { image_url: imagemUrl, prompt };
    if (modelId) corpo.motion_id = modelId;
    return await executarJobHiggsfield(endpointPath, corpo, opcoes.timeoutMs ?? 120_000);
  } catch (err) {
    throw new VideoIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
  }
}

// Gera uma imagem a partir de um prompt de texto (Agente de Design) — usa o
// mesmo provider/credenciais do vídeo, endpoint diferente
// (HIGGSFIELD_IMAGE_ENDPOINT_PATH, default confirmado na doc pública:
// /higgsfield-ai/soul/standard).
export async function gerarImagem(
  prompt: string,
  opcoes: { aspectRatio?: string; resolution?: string; timeoutMs?: number } = {},
): Promise<MidiaGerada> {
  try {
    const endpointPath = process.env.HIGGSFIELD_IMAGE_ENDPOINT_PATH ?? "/higgsfield-ai/soul/standard";
    const corpo: Record<string, unknown> = {
      prompt,
      aspect_ratio: opcoes.aspectRatio ?? "1:1",
      resolution: opcoes.resolution ?? "1024p",
    };
    return await executarJobHiggsfield(endpointPath, corpo, opcoes.timeoutMs ?? 90_000);
  } catch (err) {
    throw new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
  }
}
