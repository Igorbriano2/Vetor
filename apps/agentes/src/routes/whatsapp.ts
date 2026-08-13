import { Router } from "express";
import { extrairMensagens, extrairMensagensDeAudio } from "../integrations/whatsapp.js";
import { processarMensagemRecebida, processarAudioRecebido } from "../agents/secretario.js";

export const whatsappRouter = Router();

// Verificação do webhook exigida pela Meta Cloud API na configuração inicial.
whatsappRouter.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

whatsappRouter.post("/webhook", async (req, res) => {
  // Responde 200 imediatamente — a Meta espera resposta rápida e reenvia em caso de timeout.
  res.sendStatus(200);

  const mensagens = extrairMensagens(req.body);
  for (const { numero, texto } of mensagens) {
    try {
      await processarMensagemRecebida(numero, texto);
    } catch (err) {
      console.error(`Erro ao processar mensagem de ${numero}:`, err);
    }
  }

  const audios = extrairMensagensDeAudio(req.body);
  for (const { numero, mediaId } of audios) {
    try {
      await processarAudioRecebido(numero, mediaId);
    } catch (err) {
      console.error(`Erro ao processar áudio de ${numero}:`, err);
    }
  }
});
