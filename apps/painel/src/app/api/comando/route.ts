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
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;

  if (!texto) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  // Fase 2 do VETOR Manager V2 — assetIds é aditivo (Array.isArray falha
  // silenciosamente pra undefined/formato antigo, nunca quebra uma chamada
  // que não manda esse campo). Limite de 5 por mensagem: nunca uma missão
  // paga em lote acidental por causa de um anexo de chat.
  const assetIdsBrutos = Array.isArray(body?.assetIds) ? (body.assetIds as unknown[]) : [];
  const assetIds = assetIdsBrutos.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 5);

  // Nunca confia cegamente nos ids vindos do navegador — confirma que cada
  // um é um business_asset real, do MESMO cliente (RLS já bloquearia um id
  // de outro tenant, isso aqui é só pra descartar silenciosamente um id
  // inválido/apagado em vez de mandar lixo pro agente).
  let assetIdsValidados: string[] = [];
  if (assetIds.length > 0) {
    const { data: assetsReais } = await supabase
      .from("business_assets")
      .select("id")
      .eq("cliente_id", usuario.cliente_id)
      .in("id", assetIds);
    const idsReais = new Set((assetsReais ?? []).map((a) => a.id as string));
    assetIdsValidados = assetIds.filter((id) => idsReais.has(id));
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
        conversation_id: conversationId,
        usuario_id: user.id,
        asset_ids: assetIdsValidados,
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
