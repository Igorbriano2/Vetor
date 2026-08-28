// Cliente do serviço de render (apps/render, Parte 5/6) — nunca chama
// ffmpeg direto daqui: apps/agentes não tem ffmpeg instalado (por design,
// ver o achado da spike: buildpack node-js não garante o binário). Toda
// operação de mídia pesada atravessa esse serviço dedicado, autenticado
// pelo mesmo INTERNAL_API_TOKEN já usado entre agentes/painel.

export class RenderServiceIndisponivelError extends Error {}

export interface ProxyGerado {
  bucket: string;
  storagePath: string;
  bytes: number;
  durationMs: number;
}

function baseUrlEToken(): { baseUrl: string; token: string } {
  const baseUrl = process.env.RENDER_SERVICE_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!baseUrl || !token) {
    throw new RenderServiceIndisponivelError("RENDER_SERVICE_URL/INTERNAL_API_TOKEN não configurados — serviço de render indisponível.");
  }
  return { baseUrl, token };
}

export async function gerarProxyDeVideo(params: {
  bucket: "artifacts" | "brand-assets" | "uploads";
  storagePath: string;
  clienteId: string;
}): Promise<ProxyGerado> {
  const { baseUrl, token } = baseUrlEToken();

  try {
    const res = await fetch(`${baseUrl}/render/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": token },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new RenderServiceIndisponivelError(`Falha ao gerar proxy (${res.status}): ${texto}`);
    }
    return (await res.json()) as ProxyGerado;
  } catch (err) {
    throw err instanceof RenderServiceIndisponivelError
      ? err
      : new RenderServiceIndisponivelError(err instanceof Error ? err.message : "erro desconhecido ao chamar o serviço de render");
  }
}

export interface SinalDeReferencia {
  durationMs: number;
  width: number;
  height: number;
  cutsMs: number[];
  meanVolumeDb: number | null;
  frames: Array<{ atMs: number; dataUrl: string }>;
}

// Pede ao serviço de render o sinal BRUTO real (ffmpeg/ffprobe) de um vídeo
// de referência — nunca interpreta esse sinal aqui, quem transforma isso
// num ReferenceVideoProfile é referenceVideoAnalysis.ts.
export async function analisarVideoDeReferencia(params: {
  bucket: "artifacts" | "brand-assets" | "uploads";
  storagePath: string;
}): Promise<SinalDeReferencia> {
  const { baseUrl, token } = baseUrlEToken();

  try {
    const res = await fetch(`${baseUrl}/render/analisar-referencia`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": token },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new RenderServiceIndisponivelError(`Falha ao analisar vídeo de referência (${res.status}): ${texto}`);
    }
    return (await res.json()) as SinalDeReferencia;
  } catch (err) {
    throw err instanceof RenderServiceIndisponivelError
      ? err
      : new RenderServiceIndisponivelError(err instanceof Error ? err.message : "erro desconhecido ao chamar o serviço de render");
  }
}

export interface RenderFinalGerado {
  bucket: string;
  storagePath: string;
  bytes: number;
  durationMs: number;
}

// Pede ao serviço de render o MP4 final de verdade (trim + legendas
// queimadas, se houver) — sempre a partir do arquivo ORIGINAL enviado pelo
// cliente, nunca do proxy (ver apps/render/src/ffmpeg/finalRender.ts).
// Usado só pro trecho leve de transcrição (1 corte simples) — pra
// finalizar a timeline de verdade, ver renderizarVideoFinalMultiClip.
export async function renderizarVideoFinal(params: {
  bucket: "artifacts" | "brand-assets" | "uploads";
  storagePath: string;
  clienteId: string;
  trimInMs: number;
  trimOutMs: number;
  captions?: Array<{ startMs: number; endMs: number; text: string }>;
}): Promise<RenderFinalGerado> {
  const { baseUrl, token } = baseUrlEToken();

  try {
    const res = await fetch(`${baseUrl}/render/final`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": token },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new RenderServiceIndisponivelError(`Falha ao renderizar vídeo final (${res.status}): ${texto}`);
    }
    return (await res.json()) as RenderFinalGerado;
  } catch (err) {
    throw err instanceof RenderServiceIndisponivelError
      ? err
      : new RenderServiceIndisponivelError(err instanceof Error ? err.message : "erro desconhecido ao chamar o serviço de render");
  }
}

export interface ClipeParaRenderFinal {
  bucket: "artifacts" | "brand-assets" | "uploads";
  storagePath: string;
  tipo: "video" | "image";
  trimInMs: number;
  trimOutMs: number;
  speed?: number;
  volume?: number;
}

function esperarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RenderJobStatus {
  status: "queued" | "processing" | "done" | "failed";
  result?: RenderFinalGerado;
  error?: string;
}

// Intervalo de polling e teto de espera — achado ao vivo (2026-08-28): um
// render multi-clipe de vídeos reais passa fácil dos ~60s de timeout fixo
// do proxy reverso da DO App Platform, por isso a rota virou um job
// assíncrono (ver comentário em apps/render/src/routes/render.ts). 5min é
// generoso o bastante pra clipes de alguns minutos numa instance basic-xs
// sem travar a etapa da missão indefinidamente se o job realmente morrer.
const INTERVALO_POLLING_MS = 3000;
const TETO_ESPERA_MS = 5 * 60 * 1000;

// Implementação real da Fase 4 do prompt mestre — concatena TODOS os
// clipes de TODAS as faixas de vídeo/imagem da timeline (na ordem dada),
// cada um com seu próprio trim/speed/volume. Substitui renderizarVideoFinal
// no estágio "final_render" quando a timeline tem mais de 1 clipe editável
// (ver apps/render/src/routes/render.ts, POST /render/final-multi-clip).
// Job assíncrono: a rota responde na hora com {jobId} (a requisição de
// CRIAÇÃO nunca é o gargalo), e este cliente faz polling em GET
// /render/final-multi-clip/:jobId até "done"/"failed" — nunca segura 1
// única requisição HTTP até o ffmpeg terminar de verdade.
export async function renderizarVideoFinalMultiClip(params: {
  clienteId: string;
  clipes: ClipeParaRenderFinal[];
  width: number;
  height: number;
  fps: number;
  captions?: Array<{ startMs: number; endMs: number; text: string }>;
}): Promise<RenderFinalGerado> {
  const { baseUrl, token } = baseUrlEToken();

  let jobId: string;
  try {
    const res = await fetch(`${baseUrl}/render/final-multi-clip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": token },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new RenderServiceIndisponivelError(`Falha ao criar job de render final multi-clipe (${res.status}): ${texto}`);
    }
    ({ jobId } = (await res.json()) as { jobId: string });
  } catch (err) {
    throw err instanceof RenderServiceIndisponivelError
      ? err
      : new RenderServiceIndisponivelError(err instanceof Error ? err.message : "erro desconhecido ao chamar o serviço de render");
  }

  const inicio = Date.now();
  while (Date.now() - inicio < TETO_ESPERA_MS) {
    await esperarMs(INTERVALO_POLLING_MS);

    let statusRes: Response;
    try {
      statusRes = await fetch(`${baseUrl}/render/final-multi-clip/${jobId}`, {
        headers: { "x-internal-token": token },
      });
    } catch (err) {
      throw new RenderServiceIndisponivelError(err instanceof Error ? err.message : "erro desconhecido ao consultar o job de render");
    }
    if (!statusRes.ok) {
      const texto = await statusRes.text();
      throw new RenderServiceIndisponivelError(`Falha ao consultar job de render (${statusRes.status}): ${texto}`);
    }

    const job = (await statusRes.json()) as RenderJobStatus;
    if (job.status === "done") {
      if (!job.result) throw new RenderServiceIndisponivelError("Job de render marcado como concluído sem resultado.");
      return job.result;
    }
    if (job.status === "failed") {
      throw new RenderServiceIndisponivelError(job.error ?? "Render final multi-clipe falhou sem detalhe do erro.");
    }
    // "queued"/"processing" — continua esperando.
  }

  throw new RenderServiceIndisponivelError(`Job de render final multi-clipe (${jobId}) não terminou em ${TETO_ESPERA_MS / 1000}s.`);
}
