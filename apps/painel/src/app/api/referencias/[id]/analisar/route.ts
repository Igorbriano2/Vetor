import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) {
    return NextResponse.json({ error: "Seu usuário ainda não está vinculado a um cliente" }, { status: 403 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Análise de referência ainda não está configurada neste ambiente." }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${agentesUrl}/referencias/${id}/analisar-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ cliente_id: usuario.cliente_id }),
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("Erro ao analisar referência:", err);
    return NextResponse.json({ error: "Não consegui analisar essa referência agora. Tenta de novo em instantes." }, { status: 502 });
  }
}
