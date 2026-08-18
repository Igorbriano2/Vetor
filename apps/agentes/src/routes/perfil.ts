import { Router } from "express";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { supabase } from "../db/supabase.js";
import { sintetizarFala, SinteseVozIndisponivelError } from "../integrations/tts.js";

export const perfilRouter = Router();
perfilRouter.use(exigirAuthInterna);

// Saudação de áudio em todo carregamento/refresh autenticado do painel —
// a pedido explícito do dono do produto (deixou de ser "só na primeira
// vez"; welcome_audio_played_at não é mais lido nem escrito aqui, a coluna
// fica só como histórico de quando a saudação tocou pela primeira vez).
// Erro de TTS nunca quebra a rota: o texto sempre volta, o áudio é
// best-effort (spec: "tratar erro de TTS sem quebrar o painel").
perfilRouter.post("/saudacao", async (req, res) => {
  const { usuario_id } = req.body ?? {};
  if (typeof usuario_id !== "string") {
    res.status(400).json({ error: "usuario_id é obrigatório" });
    return;
  }

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("nome, preferencias, clientes(nome_empresa)")
    .eq("id", usuario_id)
    .maybeSingle();

  if (error || !usuario) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const nome =
    usuario.nome || (usuario.clientes as unknown as { nome_empresa?: string } | null)?.nome_empresa || "";
  const texto = nome ? `Olá, ${nome}. Como posso ser útil para você hoje?` : "Olá! Como posso ser útil para você hoje?";

  const preferencias = (usuario.preferencias as { silenciar_audio?: boolean } | null) ?? {};
  if (preferencias.silenciar_audio) {
    res.json({ texto, audioBase64: null, jaTocada: false });
    return;
  }

  try {
    const audio = await sintetizarFala(texto);
    res.json({ texto, audioBase64: Buffer.from(audio.bytes).toString("base64"), jaTocada: false });
  } catch (err) {
    if (!(err instanceof SinteseVozIndisponivelError)) {
      console.error("Erro ao sintetizar saudação:", err instanceof Error ? err.message : err);
    }
    res.json({ texto, audioBase64: null, jaTocada: false });
  }
});

perfilRouter.post("/preferencias", async (req, res) => {
  const { usuario_id, silenciar_audio } = req.body ?? {};
  if (typeof usuario_id !== "string") {
    res.status(400).json({ error: "usuario_id é obrigatório" });
    return;
  }

  const { data: atual } = await supabase.from("usuarios").select("preferencias").eq("id", usuario_id).maybeSingle();
  const preferenciasAtuais = (atual?.preferencias as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from("usuarios")
    .update({ preferencias: { ...preferenciasAtuais, silenciar_audio: !!silenciar_audio } })
    .eq("id", usuario_id);

  if (error) {
    res.status(500).json({ error: "Falha ao salvar preferências" });
    return;
  }
  res.json({ status: "ok" });
});
