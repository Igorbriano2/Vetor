import { Router } from "express";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { processarMensagemPlataforma, processarAudioPlataforma } from "../agents/vetorPlataforma.js";

export const plataformaRouter = Router();

// Autenticação simples entre serviços internos (painel -> agentes), não exposta
// ao navegador. O painel resolve o cliente_id a partir da sessão Supabase do
// usuário antes de chamar essa rota — nunca confia em cliente_id vindo do
// navegador diretamente.
plataformaRouter.use(exigirAuthInterna);

plataformaRouter.post("/mensagem", async (req, res) => {
  const { cliente_id, texto, responder_em_voz, conversation_id, usuario_id } = req.body ?? {};
  if (!cliente_id || typeof texto !== "string" || !texto.trim()) {
    res.status(400).json({ error: "cliente_id e texto são obrigatórios" });
    return;
  }

  try {
    const resultado = await processarMensagemPlataforma(cliente_id, texto, {
      responderEmVoz: !!responder_em_voz,
      conversationId: typeof conversation_id === "string" ? conversation_id : undefined,
      usuarioId: typeof usuario_id === "string" ? usuario_id : undefined,
    });
    res.json(resultado);
  } catch (err) {
    console.error(`Erro ao processar mensagem da plataforma (cliente ${cliente_id}):`, err);
    res.status(500).json({ error: "Falha ao processar mensagem" });
  }
});

plataformaRouter.post("/audio", async (req, res) => {
  const { cliente_id, audio_base64, mime_type, conversation_id, usuario_id } = req.body ?? {};
  if (!cliente_id || typeof audio_base64 !== "string" || !audio_base64) {
    res.status(400).json({ error: "cliente_id e audio_base64 são obrigatórios" });
    return;
  }

  try {
    const buffer = Buffer.from(audio_base64, "base64");
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const resultado = await processarAudioPlataforma(cliente_id, bytes, mime_type ?? "audio/webm", {
      conversationId: typeof conversation_id === "string" ? conversation_id : undefined,
      usuarioId: typeof usuario_id === "string" ? usuario_id : undefined,
    });
    res.json(resultado);
  } catch (err) {
    console.error(`Erro ao processar áudio da plataforma (cliente ${cliente_id}):`, err);
    res.status(500).json({ error: "Falha ao processar áudio" });
  }
});
