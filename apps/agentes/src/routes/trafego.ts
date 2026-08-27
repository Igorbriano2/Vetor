import { Router } from "express";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { sincronizarTrafego, ContaDeAnuncioNaoConectadaError } from "../connections/metaAdsSync.js";
import { supabase } from "../db/supabase.js";

export const trafegoRouter = Router();
trafegoRouter.use(exigirAuthInterna);

// Idempotente por natureza — sincronizar de novo só atualiza os valores
// (upsert por meta_campaign_id) e cria uma nova linha de análise, nunca
// duplica campanha nem quebra se chamado em sequência.
const DATE_PRESETS_PERMITIDOS = new Set(["last_7d", "last_14d", "last_30d", "last_90d", "this_month", "last_month"]);

trafegoRouter.post("/sincronizar", async (req, res) => {
  const { cliente_id, date_preset } = req.body ?? {};
  if (typeof cliente_id !== "string") {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }
  if (date_preset !== undefined && (typeof date_preset !== "string" || !DATE_PRESETS_PERMITIDOS.has(date_preset))) {
    res.status(400).json({ error: `date_preset inválido — use um de: ${[...DATE_PRESETS_PERMITIDOS].join(", ")}` });
    return;
  }

  try {
    const resultado = await sincronizarTrafego(cliente_id, date_preset);
    res.json(resultado);
  } catch (err) {
    if (err instanceof ContaDeAnuncioNaoConectadaError) {
      res.status(409).json({ error: err.message, code: "NAO_CONECTADO" });
      return;
    }
    console.error(`Erro ao sincronizar tráfego (cliente ${cliente_id}):`, err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Falha ao sincronizar campanhas" });
  }
});

trafegoRouter.get("/analises", async (req, res) => {
  const cliente_id = req.query.cliente_id;
  if (typeof cliente_id !== "string") {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }

  const { data, error } = await supabase
    .from("trafego_analises")
    .select("id, data, metricas_usadas, diagnostico, oportunidades, riscos, recomendacoes, created_at")
    .eq("cliente_id", cliente_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    res.status(500).json({ error: "Falha ao buscar análise" });
    return;
  }
  res.json({ analise: data?.[0] ?? null });
});
