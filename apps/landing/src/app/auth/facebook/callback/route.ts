import { NextRequest, NextResponse } from "next/server";

// Redirect URI cadastrada caractere por caractere no app Meta ("Vetor-App"):
// https://vetormkt.online/auth/facebook/callback — precisa viver aqui
// (apps/landing serve o domínio raiz vetormkt.online; o painel fica em
// painel.vetormkt.online, um host diferente pra Meta).
//
// Não precisa de sessão/cookie nesta rota: o `state` (gerado em
// apps/painel/src/app/api/connections/facebook/start) já amarra o code ao
// cliente/usuário certo, validado inteiramente em apps/agentes (service-role)
// — este endpoint só repassa code+state e redireciona o navegador de volta
// pro painel.
const PAINEL_URL = process.env.PAINEL_URL ?? "https://painel.vetormkt.online";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erroProvedor = url.searchParams.get("error");

  if (erroProvedor) {
    return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?erro=${encodeURIComponent(erroProvedor)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?erro=callback_incompleto`);
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?erro=nao_configurado`);
  }

  try {
    const res = await fetch(`${agentesUrl}/connections/facebook/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) {
      return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?erro=falha_facebook`);
    }
    // Login trouxe mais de um ativo (comum quando a conta administra vários
    // negócios) — manda pra tela de seleção em vez de dar como "conectado"
    // direto, pra não misturar dados de negócios sem relação no cliente atual.
    const corpo = (await res.json()) as { pendentesDeSelecao?: boolean };
    if (corpo.pendentesDeSelecao) {
      return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?aba=conexoes&selecionar_contas=1`);
    }
    return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?conectado=facebook`);
  } catch (err) {
    console.error("Erro no callback do Login do Facebook para Empresas:", err);
    return NextResponse.redirect(`${PAINEL_URL}/configuracoes/negocio?erro=falha_facebook`);
  }
}
