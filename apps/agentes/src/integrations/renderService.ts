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

// Implementação real da Fase 4 do prompt mestre — concatena TODOS os
// clipes de TODAS as faixas de vídeo/imagem da timeline (na ordem dada),
// cada um com seu próprio trim/speed/volume. Substitui renderizarVideoFinal
// no estágio "final_render" quando a timeline tem mais de 1 clipe editável
// (ver apps/render/src/routes/render.ts, POST /render/final-multi-clip).
export async function renderizarVideoFinalMultiClip(params: {
  clienteId: string;
  clipes: ClipeParaRenderFinal[];
  width: number;
  height: number;
  fps: number;
  captions?: Array<{ startMs: number; endMs: number; text: string }>;
}): Promise<RenderFinalGerado> {
  const { baseUrl, token } = baseUrlEToken();

  try {
    const res = await fetch(`${baseUrl}/render/final-multi-clip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": token },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new RenderServiceIndisponivelError(`Falha ao renderizar vídeo final multi-clipe (${res.status}): ${texto}`);
    }
    return (await res.json()) as RenderFinalGerado;
  } catch (err) {
    throw err instanceof RenderServiceIndisponivelError
      ? err
      : new RenderServiceIndisponivelError(err instanceof Error ? err.message : "erro desconhecido ao chamar o serviço de render");
  }
}
