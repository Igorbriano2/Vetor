import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Início do OAuth (Instagram / Meta Ads / Meta Business): resolve
// cliente/usuário da sessão real (nunca confia em nada vindo da URL),
// registra o state no backend (service-role) e redireciona o navegador pro
// diálogo oficial do provedor. WhatsApp usa Embedded Signup (SDK), não este
// fluxo de redirect — ver /api/connections/whatsapp/embedded.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) {
    return NextResponse.redirect(new URL("/configuracoes/negocio?erro=sem_cliente", request.url));
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.redirect(new URL("/configuracoes/negocio?erro=nao_configurado", request.url));
  }

  const res = await fetch(`${agentesUrl}/connections/${provider}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ cliente_id: usuario.cliente_id, usuario_id: user.id }),
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL(`/configuracoes/negocio?erro=conexao_${provider}`, request.url));
  }

  const data = (await res.json()) as { authorizeUrl: string };
  return NextResponse.redirect(data.authorizeUrl);
}
