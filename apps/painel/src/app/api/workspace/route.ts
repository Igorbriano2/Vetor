import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COOKIE_WORKSPACE } from "@/lib/workspace/resolverClienteAtivo";

// Fase 8 do reset de produto — troca de workspace. Só admin_vetor pode
// trocar (checado aqui a partir do banco, nunca confiando em nada vindo do
// corpo da requisição) — um cliente comum nunca consegue ver dado de outro
// tenant, mesmo chamando esta rota direto.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("papel").eq("id", user.id).maybeSingle();
  if (usuario?.papel !== "admin_vetor") {
    return NextResponse.json({ error: "Só admin_vetor pode trocar de workspace" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const clienteId = typeof body?.clienteId === "string" ? body.clienteId : null;
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId é obrigatório" }, { status: 400 });
  }

  const { data: existe } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();
  if (!existe) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_WORKSPACE, clienteId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
