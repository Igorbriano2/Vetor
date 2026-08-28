import { clienteAutenticadoOuErro, repassarParaAgentes } from "@/lib/aiSuite/proxy";

export async function GET(request: Request) {
  const resolvido = await clienteAutenticadoOuErro();
  if ("erro" in resolvido) return resolvido.erro;

  const { searchParams } = new URL(request.url);
  const idioma = searchParams.get("idioma");
  return repassarParaAgentes(`/ai-suite/voices${idioma ? `?idioma=${encodeURIComponent(idioma)}` : ""}`, { method: "GET" });
}
