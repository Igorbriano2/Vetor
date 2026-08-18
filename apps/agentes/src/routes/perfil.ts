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

// Síntese de voz avulsa — usada pelo assistente de voz do painel pra ler em
// voz alta um evento que aconteceu fora do ciclo pergunta/resposta normal
// (ex: uma etapa de missão que passou a exigir aprovação enquanto o cliente
// já tinha voltado ao "standby"). O texto já vem pronto do chamador (o
// painel só fala o que a própria Realtime/RLS já deixou ele ver — mesmo
// modelo de confiança de responderEmVoz em /plataforma/mensagem); aqui só
// valida tamanho pra não estourar custo com um payload absurdo.
const TAMANHO_MAXIMO_TEXTO_FALAR = 2000;

perfilRouter.post("/falar", async (req, res) => {
  const { texto } = req.body ?? {};
  if (typeof texto !== "string" || !texto.trim()) {
    res.status(400).json({ error: "texto é obrigatório" });
    return;
  }
  if (texto.length > TAMANHO_MAXIMO_TEXTO_FALAR) {
    res.status(400).json({ error: `texto excede o limite de ${TAMANHO_MAXIMO_TEXTO_FALAR} caracteres` });
    return;
  }

  try {
    const audio = await sintetizarFala(texto);
    res.json({ audioBase64: Buffer.from(audio.bytes).toString("base64") });
  } catch (err) {
    if (!(err instanceof SinteseVozIndisponivelError)) {
      console.error("Erro ao sintetizar fala avulsa:", err instanceof Error ? err.message : err);
    }
    res.json({ audioBase64: null });
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
