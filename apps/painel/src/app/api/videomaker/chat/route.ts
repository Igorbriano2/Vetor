import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Proxy pro ChatCut (apps/agentes/src/routes/videoChat.ts) — exige sessão
// válida (não usa cliente_id vindo do corpo, evita um usuário mandar
// resumo/mensagem em nome de outro tenant), mas a timeline em si nunca é
// lida/gravada aqui: o painel já resolveu o resumo no client antes de
// chamar, e quem aplica o plano de volta na timeline é o próprio client.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.resumo || typeof body.mensagem !== "string") {
    return NextResponse.json({ error: "resumo e mensagem são obrigatórios" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  const res = await fetch(`${agentesUrl}/video-chat/editar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ resumo: body.resumo, mensagem: body.mensagem, historico: body.historico ?? [] }),
  });

  if (!res.ok) return NextResponse.json({ error: "Falha ao interpretar o pedido de edição" }, { status: 502 });
  return NextResponse.json(await res.json());
}
