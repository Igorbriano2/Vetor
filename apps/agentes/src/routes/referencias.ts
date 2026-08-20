import { Router } from "express";
import { supabase } from "../db/supabase.js";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { gerarPerfilDeVideoDeReferencia } from "../negocio/referenceVideoAnalysis.js";

// Fase 3 do upgrade Gravyx (Rodada C) — generaliza o ReferenceStyleProfile
// (antes só acionável direto por asset_id via routes/plataforma.ts/tool do
// agente) pra também partir de um item já catalogado em
// reference_library_items, chamado pelo painel na página /referencias.

export const referenciasRouter = Router();
referenciasRouter.use(exigirAuthInterna);

referenciasRouter.post("/:id/analisar-video", async (req, res) => {
  const { id } = req.params;
  const { cliente_id } = req.body ?? {};
  if (!cliente_id) {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }

  const { data: item } = await supabase
    .from("reference_library_items")
    .select("id, cliente_id, source_type, asset_id")
    .eq("id", id)
    .maybeSingle();

  if (!item || item.cliente_id !== cliente_id) {
    res.status(404).json({ error: "Referência não encontrada" });
    return;
  }
  if (item.source_type !== "upload" || !item.asset_id) {
    res.status(400).json({ error: "Só referências vindas de um arquivo do Drive podem ter o estilo analisado — esta é um link externo." });
    return;
  }

  try {
    const perfil = await gerarPerfilDeVideoDeReferencia({
      clienteId: cliente_id,
      assetId: item.asset_id as string,
      referenceLibraryItemId: item.id as string,
    });
    res.status(201).json({ perfil });
  } catch (err) {
    console.error(`Erro ao analisar referência ${id}:`, err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao analisar o vídeo de referência." });
  }
});
