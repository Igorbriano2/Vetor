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
  const audioBase64 = typeof body?.audio_base64 === "string" ? body.audio_base64 : "";
  const mimeType = typeof body?.mime_type === "string" ? body.mime_type : "audio/webm";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;
  // Só o assistente de voz manda "voice_wake_word" — qualquer outro valor
  // (ou ausência) vira undefined e o backend usa o default "painel_audio".
  const origem = body?.origem === "voice_wake_word" ? "voice_wake_word" : undefined;

  if (!audioBase64) {
    return NextResponse.json({ error: "Áudio vazio" }, { status: 400 });
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
    const res = await fetch(`${agentesUrl}/plataforma/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({
        cliente_id: usuario.cliente_id,
        audio_base64: audioBase64,
        mime_type: mimeType,
        conversation_id: conversationId,
        usuario_id: user.id,
        origem,
      }),
    });

    if (!res.ok) {
      throw new Error(`apps/agentes respondeu ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Erro ao enviar áudio pro Vetor:", err);
    return NextResponse.json(
      { error: "Não consegui processar o áudio agora. Tenta de novo em instantes." },
      { status: 502 },
    );
  }
}
