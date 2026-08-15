import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; approvalId: string }> }) {
  const { id: missaoId, approvalId } = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const decisao = body?.decisao;

  if (decisao !== "aprovar" && decisao !== "rejeitar") {
    return NextResponse.json({ error: "decisao deve ser 'aprovar' ou 'rejeitar'" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;

  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Aprovações ainda não estão configuradas neste ambiente." }, { status: 503 });
  }

  const rota = decisao === "aprovar" ? "aprovar" : "rejeitar";

  try {
    const upstream = await fetch(`${agentesUrl}/plataforma/missoes/${missaoId}/aprovacoes/${approvalId}/${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ usuario_id: user.id }),
    });

    if (!upstream.ok) {
      throw new Error(`apps/agentes respondeu ${upstream.status}`);
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Erro ao decidir aprovação:", err);
    return NextResponse.json({ error: "Não consegui registrar a decisão agora. Tenta de novo em instantes." }, { status: 502 });
  }
}
