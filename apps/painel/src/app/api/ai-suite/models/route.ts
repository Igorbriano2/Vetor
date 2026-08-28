import { clienteAutenticadoOuErro, repassarParaAgentes } from "@/lib/aiSuite/proxy";

export async function GET(request: Request) {
  const resolvido = await clienteAutenticadoOuErro();
  if ("erro" in resolvido) return resolvido.erro;

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  return repassarParaAgentes(`/ai-suite/models${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, { method: "GET" });
}
