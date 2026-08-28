import { clienteAutenticadoOuErro, repassarParaAgentes } from "@/lib/aiSuite/proxy";

export async function GET(request: Request) {
  const resolvido = await clienteAutenticadoOuErro();
  if ("erro" in resolvido) return resolvido.erro;

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const qs = new URLSearchParams({ cliente_id: resolvido.clienteId });
  if (kind) qs.set("kind", kind);
  return repassarParaAgentes(`/ai-suite/jobs?${qs.toString()}`, { method: "GET" });
}
