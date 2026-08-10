const GRAPH_API_VERSION = "v21.0";

function isSandbox() {
  return (process.env.WHATSAPP_MODE ?? "sandbox") !== "production";
}

export async function sendWhatsappMessage(numeroDestino: string, texto: string): Promise<void> {
  if (isSandbox()) {
    console.log(`[whatsapp:sandbox] -> ${numeroDestino}: ${texto}`);
    return;
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN são obrigatórios em modo production");
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numeroDestino,
        type: "text",
        text: { body: texto },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar mensagem WhatsApp (${res.status}): ${body}`);
  }
}

export interface MensagemRecebida {
  numero: string;
  texto: string;
}

// Formato do payload de webhook da Meta Cloud API — ver
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
export function extrairMensagens(payload: unknown): MensagemRecebida[] {
  const mensagens: MensagemRecebida[] = [];

  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as
        | { messages?: unknown[] }
        | undefined;
      const rawMessages = value?.messages ?? [];
      for (const raw of rawMessages) {
        const msg = raw as { from?: string; text?: { body?: string }; type?: string };
        if (msg.type === "text" && msg.from && msg.text?.body) {
          mensagens.push({ numero: msg.from, texto: msg.text.body });
        }
      }
    }
  }

  return mensagens;
}
