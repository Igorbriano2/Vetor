import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { supabase } from "../db/supabase.js";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import { listarTodosOsModelos, iniciarGeracao, consultarStatusDoJob, type MediaKind, type GenerationRequest } from "../ai-providers/index.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Rotas da suíte de IA "estúdio direto" (Image/Video/Voice/3D Generator —
// ver docs/arquitetura-suite-ia.md). Caminho de entrada SEPARADO do
// paradigma de agente (mission_steps/specialistRunner) — aqui o cliente
// gera na hora, sem aprovação, igual ao padrão Freepik/Magnific.

export const aiSuiteRouter = Router();
aiSuiteRouter.use(exigirAuthInterna);

const KINDS_VALIDOS: MediaKind[] = ["image", "video", "voice", "3d"];

function kindValido(v: unknown): v is MediaKind {
  return typeof v === "string" && (KINDS_VALIDOS as string[]).includes(v);
}

// GET /ai-suite/models?kind=image — alimenta o <ModelPicker/>. "Automático"
// é sempre a primeira opção mostrada na UI (a UI decide isso, aqui só
// devolve o catálogo real).
aiSuiteRouter.get("/models", async (req, res) => {
  const { kind } = req.query;
  const modelos = await listarTodosOsModelos();
  if (kind !== undefined && !kindValido(kind)) {
    res.status(400).json({ error: `kind inválido: ${String(kind)}` });
    return;
  }
  res.json({ modelos: kind ? modelos.filter((m) => m.kind === kind) : modelos });
});

// GET /ai-suite/voices?idioma=pt-BR — alimenta o modal "Biblioteca de
// vozes" do Voice Generator (ver docs/arquitetura-suite-ia.md, Módulo 3).
aiSuiteRouter.get("/voices", async (req, res) => {
  const { idioma } = req.query;
  let query = supabase.from("voices").select("id, provider_id, nome, idioma, genero, sotaque, preview_url");
  if (typeof idioma === "string") query = query.eq("idioma", idioma);
  const { data, error } = await query.order("idioma", { ascending: true }).limit(100);
  if (error) {
    res.status(500).json({ error: "Falha ao buscar vozes" });
    return;
  }
  res.json({ voices: data ?? [] });
});

// GET /ai-suite/templates?mediaKind=image&niche=restaurante
aiSuiteRouter.get("/templates", async (req, res) => {
  const { mediaKind, niche, cliente_id } = req.query;
  if (typeof mediaKind !== "string") {
    res.status(400).json({ error: "mediaKind é obrigatório" });
    return;
  }
  let query = supabase.from("templates").select("id, media_kind, niche, title, description, thumbnail_url, prompt_or_config").eq("media_kind", mediaKind);
  if (typeof niche === "string") query = query.eq("niche", niche);
  // Curados (cliente_id nulo) + próprios do cliente, quando informado —
  // mesmo padrão de reference_library_items.
  if (typeof cliente_id === "string") {
    query = query.or(`cliente_id.eq.${cliente_id},cliente_id.is.null`);
  } else {
    query = query.is("cliente_id", null);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) {
    res.status(500).json({ error: "Falha ao buscar templates" });
    return;
  }
  res.json({ templates: data ?? [] });
});

// GET /ai-suite/jobs?cliente_id=X&kind=image — histórico ("Minhas criações").
aiSuiteRouter.get("/jobs", async (req, res) => {
  const { cliente_id, kind } = req.query;
  if (typeof cliente_id !== "string") {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }
  let query = supabase.from("generation_jobs").select("*").eq("cliente_id", cliente_id);
  if (typeof kind === "string") query = query.eq("kind", kind);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(60);
  if (error) {
    res.status(500).json({ error: "Falha ao buscar criações" });
    return;
  }
  res.json({ jobs: data ?? [] });
});

// POST /ai-suite/melhorar-prompt — único pedaço desta suíte que usa
// provider REAL desde já (Claude, já configurado em todo o resto do
// produto — nunca fica atrás do MockAdapter). Nunca gera mídia, só reescreve
// o texto do cliente pra descrever melhor o resultado visual — equivalente
// ao toggle "AI prompt" do prompt-mestre.
aiSuiteRouter.post("/melhorar-prompt", async (req, res) => {
  const { prompt, kind } = req.body ?? {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt é obrigatório" });
    return;
  }
  try {
    const resposta = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system:
        "Você melhora pedidos de geração de imagem/vídeo pra donos de pequeno negócio (restaurante, " +
        "advocacia, clínica) que não sabem escrever prompt técnico. Reescreva o pedido do cliente numa " +
        "descrição visual rica e específica (composição, iluminação, ambiente, ângulo) — nunca invente um " +
        "produto/serviço que o cliente não mencionou, só enriqueça a descrição do que ele já pediu. " +
        `Kind: ${typeof kind === "string" ? kind : "image"}. Responda só com o prompt reescrito, sem comentário.`,
      messages: [{ role: "user", content: prompt }],
    });
    const bloco = resposta.content.find((b) => b.type === "text");
    const promptMelhorado = bloco && bloco.type === "text" ? bloco.text.trim() : prompt;
    res.json({ promptMelhorado });
  } catch (err) {
    // Fail-closed honesto: nunca trava a tela por causa disso — devolve o
    // prompt original, a UI usa ele como já ia usar sem a IA.
    res.json({ promptMelhorado: prompt, aviso: err instanceof Error ? err.message : "Falha ao melhorar o prompt." });
  }
});

// POST /ai-suite/generate — cria o job de verdade: resolve modelo (auto ou
// explícito), debita crédito, chama o adapter real, persiste em
// generation_jobs. Nunca retorna sucesso sem um provider_job_id real.
aiSuiteRouter.post("/generate", async (req, res) => {
  const body = req.body ?? {};
  const { cliente_id, kind } = body;
  if (typeof cliente_id !== "string") {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }
  if (!kindValido(kind)) {
    res.status(400).json({ error: `kind inválido: ${String(kind)}` });
    return;
  }

  const request: GenerationRequest = {
    kind,
    clienteId: cliente_id,
    modelId: typeof body.modelId === "string" ? body.modelId : "auto",
    prompt: typeof body.prompt === "string" ? body.prompt : undefined,
    negativePrompt: typeof body.negativePrompt === "string" ? body.negativePrompt : undefined,
    referenceAssetIds: Array.isArray(body.referenceAssetIds) ? body.referenceAssetIds.filter((x: unknown) => typeof x === "string") : undefined,
    startFrameAssetId: typeof body.startFrameAssetId === "string" ? body.startFrameAssetId : undefined,
    endFrameAssetId: typeof body.endFrameAssetId === "string" ? body.endFrameAssetId : undefined,
    aspectRatio: typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
    resolution: typeof body.resolution === "string" ? body.resolution : undefined,
    quantity: typeof body.quantity === "number" ? body.quantity : undefined,
    durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
    extra: typeof body.extra === "object" && body.extra !== null ? body.extra : undefined,
  };

  try {
    const { jobId: providerJobId, modelo } = await iniciarGeracao(request);

    const { data: jobSalvo, error } = await supabase
      .from("generation_jobs")
      .insert({
        cliente_id,
        kind,
        model_id: modelo.id,
        provider_id: modelo.providerId,
        provider_job_id: providerJobId,
        status: "queued",
        request,
        cost_credits: modelo.costCredits,
      })
      .select("*")
      .single();
    if (error || !jobSalvo) {
      res.status(500).json({ error: `Falha ao registrar o job: ${error?.message}` });
      return;
    }

    // Débito imediato (nunca espera o job terminar pra debitar — mesmo
    // princípio "nunca completar sem registrar" do resto do produto).
    // Sem enforcement de saldo mínimo nesta rodada (ver Fase 7/G do
    // prompt-mestre — carteira de créditos completa é trabalho futuro);
    // o ledger já fica real e auditável desde já.
    await supabase.from("credit_ledger").insert({
      cliente_id,
      delta_credits: -modelo.costCredits,
      reason: "generation_debit",
      generation_job_id: jobSalvo.id,
    });

    res.json({ job: jobSalvo });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao iniciar geração" });
  }
});

// GET /ai-suite/jobs/:id/status — consulta o provider real e sincroniza o
// generation_job no Postgres (nunca deixa o status no banco ficar
// desatualizado enquanto o cliente espera). Estorna o crédito
// automaticamente se o provider reportar falha.
aiSuiteRouter.get("/jobs/:id/status", async (req, res) => {
  const { id } = req.params;
  const { cliente_id } = req.query;
  if (typeof cliente_id !== "string") {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }
  // Nunca devolve status/asset de um job de OUTRO cliente — o id do job é
  // um uuid não-enumerável, mas defesa em profundidade nunca é opcional
  // (mesmo padrão de isolamento por cliente_id usado em toda rota da base).
  const { data: job, error: erroJob } = await supabase.from("generation_jobs").select("*").eq("id", id).eq("cliente_id", cliente_id).single();
  if (erroJob || !job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }

  if (job.status === "done" || job.status === "failed") {
    res.json({ job });
    return;
  }

  try {
    const statusReal = await consultarStatusDoJob(job.provider_id as string, job.provider_job_id as string);
    if (statusReal.status === job.status) {
      res.json({ job });
      return;
    }

    const atualizacao: Record<string, unknown> = { status: statusReal.status, updated_at: new Date().toISOString() };
    if (statusReal.status === "done") atualizacao.result_asset_urls = statusReal.resultAssetUrls ?? [];
    if (statusReal.status === "failed") atualizacao.error = statusReal.error ?? "Falha desconhecida no provider.";

    const { data: jobAtualizado } = await supabase.from("generation_jobs").update(atualizacao).eq("id", id).select("*").single();

    if (statusReal.status === "failed") {
      await supabase.from("credit_ledger").insert({
        cliente_id: job.cliente_id,
        delta_credits: job.cost_credits,
        reason: "generation_refund",
        generation_job_id: job.id,
      });
    }

    res.json({ job: jobAtualizado ?? job });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao consultar status do job" });
  }
});
