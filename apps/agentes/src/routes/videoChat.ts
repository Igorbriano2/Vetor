import { Router } from "express";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { planejarEdicoesTimeline, type ResumoTimeline } from "../negocio/videoChatEdit.js";

export const videoChatRouter = Router();
videoChatRouter.use(exigirAuthInterna);

function resumoValido(valor: unknown): valor is ResumoTimeline {
  if (!valor || typeof valor !== "object") return false;
  const r = valor as Record<string, unknown>;
  return typeof r.duracaoTotalMs === "number" && Array.isArray(r.faixas) && Array.isArray(r.clipes);
}

// ChatCut — recebe um resumo da timeline atual (nunca o TimelineDocument
// bruto inteiro: o painel já reduz pra ids/tempos, evitando mandar bytes
// de mídia/keyframes desnecessários) + a mensagem do cliente, devolve um
// plano de operações. Quem aplica é o painel (mesmo timelineOps.ts do
// editor manual) — esta rota nunca escreve em video_projects.
videoChatRouter.post("/editar", async (req, res) => {
  const { resumo, mensagem, historico } = req.body ?? {};
  if (!resumoValido(resumo) || typeof mensagem !== "string" || !mensagem.trim()) {
    res.status(400).json({ error: "resumo (da timeline) e mensagem são obrigatórios" });
    return;
  }

  try {
    const plano = await planejarEdicoesTimeline(resumo, mensagem, Array.isArray(historico) ? historico : []);
    res.json(plano);
  } catch (err) {
    console.error("Erro ao planejar edições de vídeo via chat:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Falha ao interpretar o pedido de edição" });
  }
});
