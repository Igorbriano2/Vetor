import { Router } from "express";
import { supabase } from "../db/supabase.js";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { criarMissaoDeIntencao, decidirAprovacao, type PlanoConfirmado } from "../missions/orchestrator.js";

export const missoesRouter = Router();
missoesRouter.use(exigirAuthInterna);

missoesRouter.post("/", async (req, res) => {
  const { cliente_id, plano } = req.body ?? {};
  if (!cliente_id || !plano || !Array.isArray(plano.etapas) || plano.etapas.length === 0) {
    res.status(400).json({ error: "cliente_id e plano (com etapas) são obrigatórios" });
    return;
  }

  try {
    const resultado = await criarMissaoDeIntencao(cliente_id, plano as PlanoConfirmado);
    res.status(201).json(resultado);
  } catch (err) {
    console.error(`Erro ao criar missão (cliente ${cliente_id}):`, err);
    res.status(500).json({ error: "Falha ao criar missão" });
  }
});

// Leitura via este endpoint é principalmente para debug/curl — o painel lê
// missions/mission_steps/agent_runs/approvals direto do Supabase (mesmo padrão
// já usado para demandas/entregas no dashboard).
missoesRouter.get("/:id", async (req, res) => {
  const { id } = req.params;

  const [{ data: missao }, { data: etapas }, { data: aprovacoes }] = await Promise.all([
    supabase.from("missions").select("*").eq("id", id).maybeSingle(),
    supabase.from("mission_steps").select("*").eq("mission_id", id),
    supabase.from("approvals").select("*").eq("mission_id", id),
  ]);

  if (!missao) {
    res.status(404).json({ error: "Missão não encontrada" });
    return;
  }

  res.json({ missao, etapas: etapas ?? [], aprovacoes: aprovacoes ?? [] });
});

missoesRouter.post("/:id/aprovacoes/:approvalId/aprovar", async (req, res) => {
  await decidir(req, res, "aprovar");
});

missoesRouter.post("/:id/aprovacoes/:approvalId/rejeitar", async (req, res) => {
  await decidir(req, res, "rejeitar");
});

async function decidir(
  req: import("express").Request,
  res: import("express").Response,
  decisao: "aprovar" | "rejeitar",
): Promise<void> {
  const { approvalId } = req.params;
  const { usuario_id } = req.body ?? {};
  if (!usuario_id) {
    res.status(400).json({ error: "usuario_id é obrigatório" });
    return;
  }

  try {
    await decidirAprovacao(approvalId, decisao, usuario_id);
    res.json({ status: "ok" });
  } catch (err) {
    console.error(`Erro ao decidir aprovação ${approvalId}:`, err);
    res.status(500).json({ error: "Falha ao decidir aprovação" });
  }
}
