import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";

  if (!texto) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;

  if (!agentesUrl || !internalToken) {
    return NextResponse.json(
      { error: "O canal com o Vetor ainda não está configurado neste ambiente." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${agentesUrl}/plataforma/mensagem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({
        cliente_id: usuario.cliente_id,
        texto,
        responder_em_voz: !!body?.responder_em_voz,
      }),
    });

    if (!res.ok) {
      throw new Error(`apps/agentes respondeu ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Erro ao falar com o Vetor:", err);
    return NextResponse.json(
      { error: "Não consegui falar com o Vetor agora. Tenta de novo em instantes." },
      { status: 502 },
    );
  }
}
