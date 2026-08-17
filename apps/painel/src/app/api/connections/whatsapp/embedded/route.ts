import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// WhatsApp Embedded Signup entrega o code via SDK do Facebook (postMessage no
// navegador), não via redirect de página inteira — o frontend chama esta
// rota diretamente com o resultado do SDK. Config atual (WHATSAPP_CONFIG_ID)
// usa a versão vigente recomendada pela Meta, nunca a Embedded Signup v2
// (descontinuada em 15/10/2026 — ver .env.example).
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) return NextResponse.json({ error: "Sem cliente vinculado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { code, waba_id, phone_number_id } = body ?? {};
  if (!code || !waba_id || !phone_number_id) {
    return NextResponse.json({ error: "code, waba_id e phone_number_id são obrigatórios" }, { status: 400 });
  }

  const agentesUrl = process.env.AGENTES_API_URL;
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!agentesUrl || !internalToken) {
    return NextResponse.json({ error: "Canal com o Vetor não configurado" }, { status: 503 });
  }

  const res = await fetch(`${agentesUrl}/connections/whatsapp/embedded`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ cliente_id: usuario.cliente_id, code, waba_id, phone_number_id }),
  });

  if (!res.ok) return NextResponse.json({ error: "Falha ao concluir conexão do WhatsApp" }, { status: 502 });
  return NextResponse.json(await res.json());
}
