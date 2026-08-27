import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) return NextResponse.json({ error: "Sem cliente vinculado" }, { status: 403 });

  const { ids } = (await request.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids (lista de strings) é obrigatório" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  const res = await fetch(`${agentesUrl}/connections/confirmar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ cliente_id: usuario.cliente_id, ids }),
  });
  if (!res.ok) return NextResponse.json({ error: "Falha ao confirmar seleção" }, { status: 502 });
  return NextResponse.json(await res.json());
}
