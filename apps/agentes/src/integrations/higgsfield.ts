// Higgsfield — geração/edição de vídeo a partir de imagem, pro agente de
// vídeo (video.md). Contrato confirmado em docs.higgsfield.ai: request
// assíncrono (POST no endpoint do modelo -> {status, request_id, status_url})
// + polling em GET /requests/{id}/status até completed/failed/nsfw/canceled.
//
// O endpoint do vídeo em si não foi 100% confirmado na documentação pública
// (só o de imagem tem exemplo completo) — HIGGSFIELD_ENDPOINT_PATH é
// configurável por env pra ajustar sem precisar mexer em código, caso o
// path real usado pela conta do cliente seja outro. HIGGSFIELD_MODEL_ID é
// enviado como campo do corpo (não faz parte da URL) — é o motion/workflow
// específico contratado.

export class VideoIndisponivelError extends Error {}

export interface VideoGerado {
  url: string;
  requestId: string;
}

function credenciais(): { keyId: string; keySecret: string } {
  const keyId = process.env.HIGGSFIELD_API_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new VideoIndisponivelError("HIGGSFIELD_API_KEY_ID/HIGGSFIELD_API_KEY_SECRET não configurados.");
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

// Gera um vídeo a partir de uma imagem + descrição de movimento. Faz o
// polling internamente (intervalo crescente, 2s -> 10s, com jitter — mesma
// estratégia recomendada na doc) até um estado terminal ou o timeout.
export async function gerarVideoAPartirDeImagem(
  imagemUrl: string,
  prompt: string,
  opcoes: { timeoutMs?: number } = {},
): Promise<VideoGerado> {
  const { keyId, keySecret } = credenciais();
  const authHeader = `Key ${keyId}:${keySecret}`;
  const endpointPath = process.env.HIGGSFIELD_ENDPOINT_PATH ?? "/higgsfield-ai/dop/standard";
  const modelId = process.env.HIGGSFIELD_MODEL_ID;

  const corpo: Record<string, unknown> = { image_url: imagemUrl, prompt };
  if (modelId) corpo.motion_id = modelId;

  const resInicial = await fetch(`${baseUrl()}${endpointPath}`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resInicial.ok) {
    const texto = await resInicial.text();
    throw new Error(`Falha ao iniciar geração de vídeo (Higgsfield, ${resInicial.status}): ${texto}`);
  }
  const inicial = (await resInicial.json()) as RespostaInicial;

  if (inicial.status === "completed") {
    return extrairUrl(inicial as unknown as RespostaStatus);
  }

  const statusUrl = inicial.status_url ?? `${baseUrl()}/requests/${inicial.request_id}/status`;
  const timeoutMs = opcoes.timeoutMs ?? 120_000;
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
      throw new Error(`Geração de vídeo terminou como "${dados.status}": ${dados.error ?? "sem detalhe"}`);
    }
  }

  throw new Error(`Timeout esperando geração de vídeo (request_id: ${inicial.request_id})`);
}

function extrairUrl(dados: RespostaStatus): VideoGerado {
  const url =
    dados.videos?.[0]?.url ??
    dados.images?.[0]?.url ??
    (typeof dados.output === "string" ? dados.output : dados.output?.url);
  if (!url) throw new Error("Higgsfield retornou completed sem URL de vídeo reconhecível.");
  return { url, requestId: dados.request_id };
}
