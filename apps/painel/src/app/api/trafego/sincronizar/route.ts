import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const datePreset = typeof body?.date_preset === "string" ? body.date_preset : undefined;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) return NextResponse.json({ error: "Sem cliente vinculado" }, { status: 403 });

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  const res = await fetch(`${agentesUrl}/trafego/sincronizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ cliente_id: usuario.cliente_id, date_preset: datePreset }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
