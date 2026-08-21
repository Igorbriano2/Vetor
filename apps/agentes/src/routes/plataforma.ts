import { Router } from "express";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { processarMensagemPlataforma, processarAudioPlataforma, type SolicitacaoOrigem } from "../agents/vetorPlataforma.js";

// Únicas origens que o painel pode declarar pra /audio — nunca confia
// cegamente num valor livre vindo do navegador (fail-closed: origem
// desconhecida cai no default "painel_audio", nunca gravada como está).
const ORIGENS_AUDIO_VALIDAS: SolicitacaoOrigem[] = ["painel_audio", "voice_wake_word"];

export const plataformaRouter = Router();

// Autenticação simples entre serviços internos (painel -> agentes), não exposta
// ao navegador. O painel resolve o cliente_id a partir da sessão Supabase do
// usuário antes de chamar essa rota — nunca confia em cliente_id vindo do
// navegador diretamente.
plataformaRouter.use(exigirAuthInterna);

plataformaRouter.post("/mensagem", async (req, res) => {
  const { cliente_id, texto, responder_em_voz, conversation_id, usuario_id, asset_ids } = req.body ?? {};
  if (!cliente_id || typeof texto !== "string" || !texto.trim()) {
    res.status(400).json({ error: "cliente_id e texto são obrigatórios" });
    return;
  }

  // Fase 2 do VETOR Manager V2 — o painel já validou que cada id pertence
  // a este cliente (ver apps/painel/src/app/api/comando/route.ts); aqui só
  // filtra o formato, nunca confia de novo sem necessidade — mas também
  // nunca assume que quem chamou já filtrou (defesa em profundidade barata).
  const assetIds = Array.isArray(asset_ids) ? asset_ids.filter((id: unknown): id is string => typeof id === "string").slice(0, 5) : [];

  try {
    const resultado = await processarMensagemPlataforma(cliente_id, texto, {
      responderEmVoz: !!responder_em_voz,
      conversationId: typeof conversation_id === "string" ? conversation_id : undefined,
      usuarioId: typeof usuario_id === "string" ? usuario_id : undefined,
      assetIds,
    });
    res.json(resultado);
  } catch (err) {
    console.error(`Erro ao processar mensagem da plataforma (cliente ${cliente_id}):`, err);
    res.status(500).json({ error: "Falha ao processar mensagem" });
  }
});

plataformaRouter.post("/audio", async (req, res) => {
  const { cliente_id, audio_base64, mime_type, conversation_id, usuario_id, origem } = req.body ?? {};
  if (!cliente_id || typeof audio_base64 !== "string" || !audio_base64) {
    res.status(400).json({ error: "cliente_id e audio_base64 são obrigatórios" });
    return;
  }

  try {
    const buffer = Buffer.from(audio_base64, "base64");
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const origemValidada = ORIGENS_AUDIO_VALIDAS.includes(origem) ? (origem as SolicitacaoOrigem) : undefined;
    const resultado = await processarAudioPlataforma(cliente_id, bytes, mime_type ?? "audio/webm", {
      conversationId: typeof conversation_id === "string" ? conversation_id : undefined,
      usuarioId: typeof usuario_id === "string" ? usuario_id : undefined,
      origem: origemValidada,
    });
    res.json(resultado);
  } catch (err) {
    console.error(`Erro ao processar áudio da plataforma (cliente ${cliente_id}):`, err);
    res.status(500).json({ error: "Falha ao processar áudio" });
  }
});
