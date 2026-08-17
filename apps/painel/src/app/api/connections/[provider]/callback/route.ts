import { NextRequest, NextResponse } from "next/server";

// Callback público (o navegador do cliente chega aqui vindo do provedor,
// sem sessão anexada da forma usual) — a validação de tenant não depende de
// sessão aqui: o state já amarra o code ao cliente/usuário certo (gravado em
// oauth_states no início do fluxo). A troca de code por token e a gravação
// criptografada acontecem inteiramente em apps/agentes (service-role).
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erroProvedor = url.searchParams.get("error");

  if (erroProvedor) {
    return NextResponse.redirect(new URL(`/configuracoes/negocio?erro=${encodeURIComponent(erroProvedor)}`, request.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/configuracoes/negocio?erro=callback_incompleto", request.url));
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.redirect(new URL("/configuracoes/negocio?erro=nao_configurado", request.url));
  }

  try {
    const res = await fetch(`${agentesUrl}/connections/${provider}/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) {
      return NextResponse.redirect(new URL(`/configuracoes/negocio?erro=falha_${provider}`, request.url));
    }
    return NextResponse.redirect(new URL(`/configuracoes/negocio?conectado=${provider}`, request.url));
  } catch (err) {
    console.error(`Erro no callback de conexão "${provider}":`, err);
    return NextResponse.redirect(new URL(`/configuracoes/negocio?erro=falha_${provider}`, request.url));
  }
}
