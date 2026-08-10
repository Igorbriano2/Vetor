import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.nome !== "string" ||
    typeof body.whatsapp !== "string" ||
    typeof body.tipo_negocio !== "string" ||
    !body.nome.trim() ||
    !body.whatsapp.trim() ||
    !body.tipo_negocio.trim()
  ) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("leads").insert({
    nome: body.nome.trim(),
    whatsapp: body.whatsapp.trim(),
    tipo_negocio: body.tipo_negocio.trim(),
  });

  if (error) {
    console.error("Erro ao salvar lead", error);
    return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
