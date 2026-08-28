import { clienteAutenticadoOuErro, repassarParaAgentes } from "@/lib/aiSuite/proxy";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvido = await clienteAutenticadoOuErro();
  if ("erro" in resolvido) return resolvido.erro;

  const { id } = await params;
  return repassarParaAgentes(`/ai-suite/jobs/${id}/status?cliente_id=${encodeURIComponent(resolvido.clienteId)}`, { method: "GET" });
}
