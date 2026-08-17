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

  const body = await request.json().catch(() => null);
  const silenciarAudio = !!body?.silenciar_audio;

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  const res = await fetch(`${agentesUrl}/perfil/preferencias`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ usuario_id: user.id, silenciar_audio: silenciarAudio }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Falha ao salvar preferências" }, { status: 502 });
  }
  return NextResponse.json(await res.json());
}
