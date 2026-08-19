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

export async function gerarProxyDeVideo(params: {
  bucket: "artifacts" | "brand-assets" | "uploads";
  storagePath: string;
  clienteId: string;
}): Promise<ProxyGerado> {
  const baseUrl = process.env.RENDER_SERVICE_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!baseUrl || !token) {
    throw new RenderServiceIndisponivelError("RENDER_SERVICE_URL/INTERNAL_API_TOKEN não configurados — serviço de render indisponível.");
  }

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
