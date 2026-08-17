import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
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
    return NextResponse.json({ connections: [] });
  }

  const res = await fetch(`${agentesUrl}/connections?cliente_id=${usuario.cliente_id}`, {
    headers: { "x-internal-token": internalToken },
  });
  if (!res.ok) return NextResponse.json({ connections: [] });
  return NextResponse.json(await res.json());
}
