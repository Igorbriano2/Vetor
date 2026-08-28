import { clienteAutenticadoOuErro, repassarParaAgentes } from "@/lib/aiSuite/proxy";

export async function GET(request: Request) {
  const resolvido = await clienteAutenticadoOuErro();
  if ("erro" in resolvido) return resolvido.erro;

  const { searchParams } = new URL(request.url);
  const mediaKind = searchParams.get("mediaKind") ?? "";
  const niche = searchParams.get("niche");
  const qs = new URLSearchParams({ mediaKind, cliente_id: resolvido.clienteId });
  if (niche) qs.set("niche", niche);
  return repassarParaAgentes(`/ai-suite/templates?${qs.toString()}`, { method: "GET" });
}
