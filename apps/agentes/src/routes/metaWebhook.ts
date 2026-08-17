import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

export const metaWebhookRouter = Router();

// Verificação inicial exigida pela Meta ao cadastrar o webhook no app
// "Vetor-App" (Instagram/Páginas/WhatsApp Business) — mesmo padrão do
// webhook do WhatsApp legado em routes/whatsapp.ts, só que com verify token
// próprio (META_WEBHOOK_VERIFY_TOKEN), já que é um app/produto diferente.
metaWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

function assinaturaValida(corpoBruto: Buffer, assinaturaHeader: string | undefined): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !assinaturaHeader?.startsWith("sha256=")) return false;

  const esperado = createHmac("sha256", appSecret).update(corpoBruto).digest("hex");
  const recebido = assinaturaHeader.slice("sha256=".length);

  const bufEsperado = Buffer.from(esperado, "hex");
  const bufRecebido = Buffer.from(recebido, "hex");
  if (bufEsperado.length !== bufRecebido.length) return false;
  return timingSafeEqual(bufEsperado, bufRecebido);
}

// Eventos de Instagram/Página/WhatsApp Business chegam aqui depois que o
// cliente conecta a conta (ver connections/*). Responde 200 rápido (a Meta
// reenvia em caso de timeout) e valida a assinatura antes de qualquer
// processamento — nunca confia em payload não assinado.
//
// PENDENTE: nenhum processamento de evento está implementado ainda (só
// validação + log) — quando o primeiro caso de uso real existir (ex:
// responder mensagem de Instagram Direct, notificar comentário), plugar
// aqui, roteando por entry[].changes[].field ou messaging[].
metaWebhookRouter.post("/", (req, res) => {
  const corpoBruto = (req as unknown as { rawBody?: Buffer }).rawBody;
  const assinatura = req.header("x-hub-signature-256");

  if (!corpoBruto || !assinaturaValida(corpoBruto, assinatura)) {
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);
  console.log("Evento recebido em /webhooks/meta:", JSON.stringify(req.body).slice(0, 500));
});
