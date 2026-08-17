import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  try {
    const res = await fetch(`${agentesUrl}/perfil/saudacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ usuario_id: user.id }),
    });
    if (!res.ok) throw new Error(`apps/agentes respondeu ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Erro ao preparar saudação:", err);
    // Nunca quebra o painel — o cockpit segue sem áudio/texto de boas-vindas.
    return NextResponse.json({ texto: null, audioBase64: null, jaTocada: true });
  }
}
