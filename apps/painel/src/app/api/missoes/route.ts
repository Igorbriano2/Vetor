import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Proxy para apps/agentes, mesmo padrão de /api/comando: resolve cliente_id da
// sessão autenticada, nunca confia em cliente_id vindo do corpo da requisição.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("cliente_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario?.cliente_id) {
    return NextResponse.json({ error: "Seu usuário ainda não está vinculado a um cliente" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const plano = body?.plano;

  if (!plano || !Array.isArray(plano.etapas) || plano.etapas.length === 0) {
    return NextResponse.json({ error: "Plano de missão inválido" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;

  if (!agentesUrl || !internalToken) {
    return NextResponse.json(
      { error: "A criação de missões ainda não está configurada neste ambiente." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${agentesUrl}/plataforma/missoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ cliente_id: usuario.cliente_id, plano }),
    });

    if (!res.ok) {
      throw new Error(`apps/agentes respondeu ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar missão:", err);
    return NextResponse.json({ error: "Não consegui confirmar a missão agora. Tenta de novo em instantes." }, { status: 502 });
  }
}
