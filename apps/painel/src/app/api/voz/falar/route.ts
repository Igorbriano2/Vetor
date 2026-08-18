import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Síntese de voz avulsa — usada pelo assistente de voz pra ler em áudio um
// evento fora do ciclo normal de pergunta/resposta (ex: uma etapa de missão
// que passou a exigir aprovação enquanto o cliente estava em "standby").
// Mesmo padrão de proxy dos outros /api/comando/* — sessão resolvida aqui,
// nunca confia num cliente_id vindo do navegador.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const texto = typeof body?.texto === "string" ? body.texto : "";
  if (!texto.trim()) {
    return NextResponse.json({ error: "texto é obrigatório" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  try {
    const res = await fetch(`${agentesUrl}/perfil/falar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
      body: JSON.stringify({ texto }),
    });
    if (!res.ok) throw new Error(`apps/agentes respondeu ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Erro ao sintetizar fala avulsa:", err);
    return NextResponse.json({ audioBase64: null });
  }
}
