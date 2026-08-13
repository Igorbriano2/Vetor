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

export interface MensagemAudioRecebida {
  numero: string;
  mediaId: string;
}

interface WhatsappMessageRaw {
  from?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string; mime_type?: string };
}

function extrairMensagensBrutas(payload: unknown): WhatsappMessageRaw[] {
  const mensagens: WhatsappMessageRaw[] = [];

  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as
        | { messages?: unknown[] }
        | undefined;
      const rawMessages = value?.messages ?? [];
      for (const raw of rawMessages) {
        mensagens.push(raw as WhatsappMessageRaw);
      }
    }
  }

  return mensagens;
}

// Formato do payload de webhook da Meta Cloud API — ver
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
export function extrairMensagens(payload: unknown): MensagemRecebida[] {
  return extrairMensagensBrutas(payload)
    .filter((msg) => msg.type === "text" && msg.from && msg.text?.body)
    .map((msg) => ({ numero: msg.from!, texto: msg.text!.body! }));
}

// Mensagens de voz — o áudio ainda precisa ser baixado e transcrito
// (ver integrations/transcricao.ts) antes de entrar na mesma pipeline de texto.
export function extrairMensagensDeAudio(payload: unknown): MensagemAudioRecebida[] {
  return extrairMensagensBrutas(payload)
    .filter((msg) => msg.type === "audio" && msg.from && msg.audio?.id)
    .map((msg) => ({ numero: msg.from!, mediaId: msg.audio!.id! }));
}

export interface MidiaBaixada {
  bytes: ArrayBuffer;
  mimeType: string;
}

// Baixar mídia é sempre um fluxo de 2 passos na Meta Cloud API: primeiro resolve
// a URL assinada a partir do media id, depois baixa o conteúdo com o mesmo token.
export async function baixarMidiaWhatsapp(mediaId: string): Promise<MidiaBaixada> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN é obrigatório para baixar mídia do WhatsApp");
  }

  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    throw new Error(`Falha ao resolver mídia ${mediaId} (${metaRes.status})`);
  }
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) {
    throw new Error(`Mídia ${mediaId} sem URL de download`);
  }

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Falha ao baixar bytes da mídia ${mediaId} (${fileRes.status})`);
  }

  return {
    bytes: await fileRes.arrayBuffer(),
    mimeType: meta.mime_type ?? "audio/ogg",
  };
}
