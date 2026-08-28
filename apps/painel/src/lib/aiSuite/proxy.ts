import { createSupabaseServerClient } from "@/lib/supabase/server";

// Todo Route Handler de /api/ai-suite/* segue o mesmo formato: resolve o
// cliente autenticado no servidor (nunca confia num cliente_id vindo do
// corpo da requisição do browser) e repassa pro apps/agentes com o token
// interno — mesmo padrão já usado em /api/trafego/sincronizar.
export async function clienteAutenticadoOuErro(): Promise<{ clienteId: string } | { erro: Response }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: Response.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) {
    return { erro: Response.json({ error: "Sem cliente vinculado" }, { status: 403 }) };
  }
  return { clienteId: usuario.cliente_id as string };
}

export function urlEToken(): { agentesUrl: string; internalToken: string } | null {
  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) return null;
  return { agentesUrl, internalToken };
}

export async function repassarParaAgentes(path: string, init: RequestInit): Promise<Response> {
  const config = urlEToken();
  if (!config) return Response.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });

  const res = await fetch(`${config.agentesUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-internal-token": config.internalToken },
  });
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
