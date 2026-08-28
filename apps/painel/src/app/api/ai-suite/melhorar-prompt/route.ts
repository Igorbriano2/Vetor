import { clienteAutenticadoOuErro, repassarParaAgentes } from "@/lib/aiSuite/proxy";

export async function POST(request: Request) {
  const resolvido = await clienteAutenticadoOuErro();
  if ("erro" in resolvido) return resolvido.erro;

  const body = await request.json().catch(() => ({}));
  return repassarParaAgentes("/ai-suite/melhorar-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
