import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Router } from "express";
import { supabase } from "../db/supabase.js";
import { montarArgsFfmpegProxy } from "../ffmpeg/proxy.js";
import { montarArgsFfprobeDuracao } from "../ffmpeg/probe.js";
import { montarArgsFfprobeInfo, parseInfoFfprobe } from "../ffmpeg/probeInfo.js";
import { montarArgsFfmpegSceneDetect, parseTimestampsDeCorteMs } from "../ffmpeg/sceneDetect.js";
import { montarArgsFfmpegVolumeDetect, parseMeanVolumeDb } from "../ffmpeg/audioVolume.js";
import { montarArgsFfmpegExtrairFrame } from "../ffmpeg/frameExtract.js";
import { montarArgsFfmpegRenderFinal, montarArgsFfmpegConcatMultiClip } from "../ffmpeg/finalRender.js";
import { montarSrtDeLegendas, type CaptionCueSimples } from "../ffmpeg/legendas.js";
import {
  executarFfmpeg,
  executarFfmpegCapturandoStderr,
  executarFfprobeDuracaoMs,
  executarFfprobeStdout,
  FfmpegError,
} from "../ffmpeg/executar.js";

export const renderRouter = Router();

const BUCKETS_PERMITIDOS = ["artifacts", "brand-assets", "uploads"] as const;
type BucketPermitido = (typeof BUCKETS_PERMITIDOS)[number];

function bucketValido(valor: unknown): valor is BucketPermitido {
  return typeof valor === "string" && (BUCKETS_PERMITIDOS as readonly string[]).includes(valor);
}

// Primeira capacidade real do serviço de render (Parte 5 / estágio 2 do
// pipeline de vídeo, Parte 4: "normalização/proxy") — pega um vídeo já
// enviado pelo cliente e gera um proxy leve pra edição na timeline. Nunca
// mexe no arquivo original (proxy é sempre um DERIVADO, a fonte de
// verdade continua o vídeo bruto enviado).
renderRouter.post("/proxy", async (req, res) => {
  const { bucket, storagePath, clienteId } = req.body as {
    bucket?: unknown;
    storagePath?: unknown;
    clienteId?: unknown;
  };

  if (!bucketValido(bucket)) {
    res.status(400).json({ error: `bucket precisa ser um de: ${BUCKETS_PERMITIDOS.join(", ")}` });
    return;
  }
  if (typeof storagePath !== "string" || !storagePath) {
    res.status(400).json({ error: "storagePath é obrigatório" });
    return;
  }
  if (typeof clienteId !== "string" || !clienteId) {
    res.status(400).json({ error: "clienteId é obrigatório" });
    return;
  }

  const pastaTemp = await mkdtemp(join(tmpdir(), "vetor-render-"));
  const caminhoEntrada = join(pastaTemp, "entrada");
  const caminhoSaida = join(pastaTemp, "proxy.mp4");

  try {
    const { data: baixado, error: erroDownload } = await supabase.storage.from(bucket).download(storagePath);
    if (erroDownload || !baixado) {
      res.status(404).json({ error: `Falha ao baixar ${bucket}/${storagePath}: ${erroDownload?.message ?? "não encontrado"}` });
      return;
    }
    await writeFile(caminhoEntrada, Buffer.from(await baixado.arrayBuffer()));

    // Duração real do ARQUIVO ORIGINAL (não do proxy) — é o que vai virar
    // o durationMs do clip na timeline; nunca inventa um valor padrão
    // (achado do editor no painel, task #78: sem isso um clip novo nascia
    // com uma duração chutada).
    const duracaoMs = await executarFfprobeDuracaoMs(montarArgsFfprobeDuracao(caminhoEntrada));

    await executarFfmpeg(montarArgsFfmpegProxy({ inputPath: caminhoEntrada, outputPath: caminhoSaida }));

    const bytesSaida = await readFile(caminhoSaida);
    const caminhoDestino = `${clienteId}/video/proxy/${randomUUID()}.mp4`;
    const { error: erroUpload } = await supabase.storage
      .from("artifacts")
      .upload(caminhoDestino, bytesSaida, { contentType: "video/mp4", upsert: false });
    if (erroUpload) {
      res.status(502).json({ error: `Falha ao subir o proxy gerado: ${erroUpload.message}` });
      return;
    }

    res.json({ bucket: "artifacts", storagePath: caminhoDestino, bytes: bytesSaida.length, durationMs: duracaoMs });
  } catch (err) {
    const mensagem = err instanceof FfmpegError ? err.message : err instanceof Error ? err.message : "erro desconhecido";
    res.status(500).json({ error: mensagem });
  } finally {
    await rm(pastaTemp, { recursive: true, force: true });
  }
});

// Quantidade de frames de amostra extraídos pra análise visual — poucos o
// suficiente pra caber numa chamada de vision, distribuídos uniformemente
// ao longo do vídeo (nunca só o início, senão a "amostra" vira só o hook).
const QUANTIDADE_FRAMES_AMOSTRA = 6;

// Segunda capacidade real do serviço de render (Parte 3: ReferenceVideoProfile)
// — extrai sinal REAL do vídeo de referência via ffmpeg/ffprobe (nunca
// estimado): duração, dimensão, timestamps de corte, volume médio de áudio
// e uma amostra de frames. Não interpreta nada disso (não fala com
// nenhum provider de IA) — quem transforma esse sinal bruto num
// ReferenceVideoProfile é o apps/agentes (ver referenceVideoAnalysis.ts),
// mesma separação de responsabilidade do /render/proxy.
renderRouter.post("/analisar-referencia", async (req, res) => {
  const { bucket, storagePath } = req.body as { bucket?: unknown; storagePath?: unknown };

  if (!bucketValido(bucket)) {
    res.status(400).json({ error: `bucket precisa ser um de: ${BUCKETS_PERMITIDOS.join(", ")}` });
    return;
  }
  if (typeof storagePath !== "string" || !storagePath) {
    res.status(400).json({ error: "storagePath é obrigatório" });
    return;
  }

  const pastaTemp = await mkdtemp(join(tmpdir(), "vetor-render-ref-"));
  const caminhoEntrada = join(pastaTemp, "entrada");

  try {
    const { data: baixado, error: erroDownload } = await supabase.storage.from(bucket).download(storagePath);
    if (erroDownload || !baixado) {
      res.status(404).json({ error: `Falha ao baixar ${bucket}/${storagePath}: ${erroDownload?.message ?? "não encontrado"}` });
      return;
    }
    await writeFile(caminhoEntrada, Buffer.from(await baixado.arrayBuffer()));

    const infoStdout = await executarFfprobeStdout(montarArgsFfprobeInfo(caminhoEntrada));
    const info = parseInfoFfprobe(infoStdout);

    const sceneStderr = await executarFfmpegCapturandoStderr(montarArgsFfmpegSceneDetect(caminhoEntrada));
    const cutsMs = parseTimestampsDeCorteMs(sceneStderr);

    // volumedetect falha (arquivo sem áudio, ex: só imagem) não derruba a
    // análise inteira — vira null, nunca um dB inventado.
    let meanVolumeDb: number | null = null;
    try {
      const volumeStderr = await executarFfmpegCapturandoStderr(montarArgsFfmpegVolumeDetect(caminhoEntrada));
      meanVolumeDb = parseMeanVolumeDb(volumeStderr);
    } catch {
      meanVolumeDb = null;
    }

    const passoMs = info.durationMs / (QUANTIDADE_FRAMES_AMOSTRA + 1);
    const timestampsAmostraMs = Array.from({ length: QUANTIDADE_FRAMES_AMOSTRA }, (_, i) => Math.round(passoMs * (i + 1)));

    const frames: Array<{ atMs: number; dataUrl: string }> = [];
    for (const atMs of timestampsAmostraMs) {
      const caminhoFrame = join(pastaTemp, `frame-${atMs}.jpg`);
      try {
        await executarFfmpeg(montarArgsFfmpegExtrairFrame(caminhoEntrada, atMs / 1000, caminhoFrame));
        const bytesFrame = await readFile(caminhoFrame);
        frames.push({ atMs, dataUrl: `data:image/jpeg;base64,${bytesFrame.toString("base64")}` });
      } catch {
        // Um frame pontual pode falhar (ex: timestamp após o último
        // keyframe decodificável) — pula ele, nunca derruba a análise
        // inteira por causa de uma amostra faltando.
      }
    }

    res.json({
      durationMs: info.durationMs,
      width: info.width,
      height: info.height,
      cutsMs,
      meanVolumeDb,
      frames,
    });
  } catch (err) {
    const mensagem = err instanceof FfmpegError ? err.message : err instanceof Error ? err.message : "erro desconhecido";
    res.status(500).json({ error: mensagem });
  } finally {
    await rm(pastaTemp, { recursive: true, force: true });
  }
});

function cuesValidos(valor: unknown): valor is CaptionCueSimples[] {
  if (!Array.isArray(valor)) return false;
  return valor.every(
    (c) =>
      c &&
      typeof c === "object" &&
      typeof (c as Record<string, unknown>).startMs === "number" &&
      typeof (c as Record<string, unknown>).endMs === "number" &&
      typeof (c as Record<string, unknown>).text === "string",
  );
}

// Terceira capacidade real do serviço de render (Parte 4/5 do pipeline:
// FINAL_RENDER) — pega o vídeo ORIGINAL enviado pelo cliente (nunca o
// proxy, ver comentário em finalRender.ts) + os cues de legenda já
// editados na timeline (video_projects.timeline_json.captions) e produz o
// MP4 entregável de verdade: trim (corte simples) + legendas queimadas
// (se houver). A fonte de verdade EDITÁVEL continua sendo os cues — isso
// aqui só renderiza uma vez que o cliente já decidiu o texto final.
renderRouter.post("/final", async (req, res) => {
  const { bucket, storagePath, clienteId, trimInMs, trimOutMs, captions } = req.body as {
    bucket?: unknown;
    storagePath?: unknown;
    clienteId?: unknown;
    trimInMs?: unknown;
    trimOutMs?: unknown;
    captions?: unknown;
  };

  if (!bucketValido(bucket)) {
    res.status(400).json({ error: `bucket precisa ser um de: ${BUCKETS_PERMITIDOS.join(", ")}` });
    return;
  }
  if (typeof storagePath !== "string" || !storagePath) {
    res.status(400).json({ error: "storagePath é obrigatório" });
    return;
  }
  if (typeof clienteId !== "string" || !clienteId) {
    res.status(400).json({ error: "clienteId é obrigatório" });
    return;
  }
  if (typeof trimInMs !== "number" || typeof trimOutMs !== "number" || trimOutMs <= trimInMs) {
    res.status(400).json({ error: "trimInMs/trimOutMs precisam ser números, com trimOutMs > trimInMs" });
    return;
  }
  if (captions !== undefined && !cuesValidos(captions)) {
    res.status(400).json({ error: "captions, quando presente, precisa ser um array de {startMs, endMs, text}" });
    return;
  }

  const pastaTemp = await mkdtemp(join(tmpdir(), "vetor-render-final-"));
  const caminhoEntrada = join(pastaTemp, "entrada");
  const caminhoSaida = join(pastaTemp, "final.mp4");
  const caminhoSrt = join(pastaTemp, "legendas.srt");

  try {
    const { data: baixado, error: erroDownload } = await supabase.storage.from(bucket).download(storagePath);
    if (erroDownload || !baixado) {
      res.status(404).json({ error: `Falha ao baixar ${bucket}/${storagePath}: ${erroDownload?.message ?? "não encontrado"}` });
      return;
    }
    await writeFile(caminhoEntrada, Buffer.from(await baixado.arrayBuffer()));

    let legendasSrtPath: string | undefined;
    if (captions && (captions as CaptionCueSimples[]).length > 0) {
      const srt = montarSrtDeLegendas(captions as CaptionCueSimples[]);
      await writeFile(caminhoSrt, srt, "utf-8");
      legendasSrtPath = caminhoSrt;
    }

    await executarFfmpeg(
      montarArgsFfmpegRenderFinal({
        inputPath: caminhoEntrada,
        outputPath: caminhoSaida,
        trimInMs,
        trimOutMs,
        legendasSrtPath,
      }),
    );

    const duracaoMs = await executarFfprobeDuracaoMs(montarArgsFfprobeDuracao(caminhoSaida));

    const bytesSaida = await readFile(caminhoSaida);
    const caminhoDestino = `${clienteId}/video/final/${randomUUID()}.mp4`;
    const { error: erroUpload } = await supabase.storage
      .from("artifacts")
      .upload(caminhoDestino, bytesSaida, { contentType: "video/mp4", upsert: false });
    if (erroUpload) {
      res.status(502).json({ error: `Falha ao subir o render final: ${erroUpload.message}` });
      return;
    }

    res.json({ bucket: "artifacts", storagePath: caminhoDestino, bytes: bytesSaida.length, durationMs: duracaoMs });
  } catch (err) {
    const mensagem = err instanceof FfmpegError ? err.message : err instanceof Error ? err.message : "erro desconhecido";
    res.status(500).json({ error: mensagem });
  } finally {
    await rm(pastaTemp, { recursive: true, force: true });
  }
});

interface ClipeDoBody {
  bucket?: unknown;
  storagePath?: unknown;
  tipo?: unknown;
  trimInMs?: unknown;
  trimOutMs?: unknown;
  speed?: unknown;
  volume?: unknown;
}

function clipeValido(valor: unknown): valor is Required<Pick<ClipeDoBody, "bucket" | "storagePath" | "tipo" | "trimInMs" | "trimOutMs">> & { speed?: number; volume?: number } {
  if (!valor || typeof valor !== "object") return false;
  const c = valor as ClipeDoBody;
  return (
    bucketValido(c.bucket) &&
    typeof c.storagePath === "string" &&
    !!c.storagePath &&
    (c.tipo === "video" || c.tipo === "image") &&
    typeof c.trimInMs === "number" &&
    typeof c.trimOutMs === "number" &&
    c.trimOutMs > c.trimInMs &&
    (c.speed === undefined || typeof c.speed === "number") &&
    (c.volume === undefined || typeof c.volume === "number")
  );
}

// Implementação real da Fase 4 do prompt mestre (achado da auditoria do
// editor de vídeo, 2026-08-27): até aqui só /final existia, e ele só lê o
// PRIMEIRO clipe da timeline — qualquer outro clipe/faixa que o cliente
// monte no editor manual ou peça ao ChatCut nunca chegava no vídeo
// entregue. Esta rota baixa TODOS os clipes reais (podem vir de arquivos
// diferentes — cada um é um asset independente do cliente), concatena na
// ordem dada via montarArgsFfmpegConcatMultiClip, e só então aplica
// legenda sobre o resultado final (nunca por clipe — a legenda é do vídeo
// inteiro já montado).
//
// Achado ao vivo (validação real com 2 clipes de vídeo reais, 2026-08-28):
// isso era síncrono — a requisição HTTP ficava aberta até o ffmpeg
// terminar. Em produção (DO App Platform, timeout fixo de proxy reverso de
// ~60s) qualquer render que passe disso morre com 503/504
// (upstream_reset_before_response_started), mesmo com args/ffmpeg 100%
// corretos (39/39 testes unitários passando não pegam isso — testam só a
// montagem dos args, não o tempo real de uma requisição). Virou job
// assíncrono (render_jobs, migration 0044): a rota cria a linha e responde
// na hora com {jobId}; o processamento roda em background no mesmo
// processo Express (apps/render é instance_count:1, então o processo
// continua vivo pra terminar o job mesmo após a resposta); apps/agentes
// faz polling em GET /final-multi-clip/:jobId em vez de segurar 1
// requisição só.
async function processarFinalMultiClip(
  jobId: string,
  params: {
    clienteId: string;
    clipes: Array<{
      bucket: BucketPermitido;
      storagePath: string;
      tipo: "video" | "image";
      trimInMs: number;
      trimOutMs: number;
      speed?: number;
      volume?: number;
    }>;
    width: number;
    height: number;
    fps: number;
    captions?: CaptionCueSimples[];
  },
): Promise<void> {
  // Achado ao vivo (2026-08-28, mesma sessão do job assíncrono): antes,
  // mkdtemp() ficava FORA do try/catch — igual ao handler síncrono
  // original, onde isso era inofensivo (uma falha ali só derrubava a
  // resposta HTTP daquela requisição, via o error handler do Express). Mas
  // isso aqui roda "fire-and-forget" (void processarFinalMultiClip(...),
  // sem ninguém esperando a promise) — qualquer exceção antes do try vira
  // unhandled rejection, que em Node moderno pode derrubar o PROCESSO
  // INTEIRO, órfãozinho o job pra sempre em "queued" (a linha nunca é
  // atualizada porque o processo morre antes de chegar no catch). Por
  // isso a função inteira agora é o try — nenhum caminho de erro escapa
  // sem escrever "failed" na linha do job.
  let pastaTempParaLimpeza: string | undefined;
  try {
    // Achado ao vivo (2026-08-28): sem essa escrita, a linha do job fica
    // em "queued" tanto enquanto está genuinamente processando quanto se
    // tiver travado/morrido — impossível distinguir os dois só olhando o
    // banco. "processing" é o sinal de vida real: se nunca aparecer, o
    // trabalho nem começou (bug antes daqui); se aparecer e nunca virar
    // "done"/"failed", travou de verdade durante o processamento.
    await supabase.from("render_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", jobId);

    const pastaTemp = await mkdtemp(join(tmpdir(), "vetor-render-multiclip-"));
    pastaTempParaLimpeza = pastaTemp;
    const caminhoSaida = join(pastaTemp, "final.mp4");
    const caminhoSrt = join(pastaTemp, "legendas.srt");

    const clipesComCaminho = await Promise.all(
      params.clipes.map(async (clipe, i) => {
        const { data: baixado, error: erroDownload } = await supabase.storage.from(clipe.bucket).download(clipe.storagePath);
        if (erroDownload || !baixado) {
          throw new Error(`Falha ao baixar clipe ${i} (${clipe.bucket}/${clipe.storagePath}): ${erroDownload?.message ?? "não encontrado"}`);
        }
        const caminhoLocal = join(pastaTemp, `clipe-${i}${clipe.tipo === "image" ? ".img" : ".mp4"}`);
        await writeFile(caminhoLocal, Buffer.from(await baixado.arrayBuffer()));
        return {
          inputPath: caminhoLocal,
          tipo: clipe.tipo,
          trimInMs: clipe.trimInMs,
          trimOutMs: clipe.trimOutMs,
          speed: clipe.speed ?? 1,
          volume: clipe.volume ?? 1,
        };
      }),
    );

    let legendasSrtPath: string | undefined;
    if (params.captions && params.captions.length > 0) {
      const srt = montarSrtDeLegendas(params.captions);
      await writeFile(caminhoSrt, srt, "utf-8");
      legendasSrtPath = caminhoSrt;
    }

    await executarFfmpeg(
      montarArgsFfmpegConcatMultiClip({
        clipes: clipesComCaminho,
        outputPath: caminhoSaida,
        legendasSrtPath,
        width: params.width,
        height: params.height,
        fps: params.fps,
      }),
    );

    const duracaoMs = await executarFfprobeDuracaoMs(montarArgsFfprobeDuracao(caminhoSaida));

    const bytesSaida = await readFile(caminhoSaida);
    const caminhoDestino = `${params.clienteId}/video/final/${randomUUID()}.mp4`;
    const { error: erroUpload } = await supabase.storage
      .from("artifacts")
      .upload(caminhoDestino, bytesSaida, { contentType: "video/mp4", upsert: false });
    if (erroUpload) {
      await supabase
        .from("render_jobs")
        .update({ status: "failed", error: `Falha ao subir o render final: ${erroUpload.message}`, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      return;
    }

    await supabase
      .from("render_jobs")
      .update({
        status: "done",
        result: { bucket: "artifacts", storagePath: caminhoDestino, bytes: bytesSaida.length, durationMs: duracaoMs },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const mensagem = err instanceof FfmpegError ? err.message : err instanceof Error ? err.message : "erro desconhecido";
    // Também blindado: se a própria escrita de "failed" falhar (ex: Supabase
    // fora do ar), a linha fica órfã em "queued"/"processing" pra sempre —
    // mas ISSO nunca vira unhandled rejection e nunca derruba o processo,
    // só fica logado (o teto de 5min do polling em apps/agentes ainda pega
    // o caso, só sem a mensagem de erro real).
    try {
      await supabase.from("render_jobs").update({ status: "failed", error: mensagem, updated_at: new Date().toISOString() }).eq("id", jobId);
    } catch (erroAoGravar) {
      console.error(`processarFinalMultiClip: falha ao gravar status "failed" do job ${jobId}:`, erroAoGravar);
    }
  } finally {
    if (pastaTempParaLimpeza) await rm(pastaTempParaLimpeza, { recursive: true, force: true }).catch(() => {});
  }
}

renderRouter.post("/final-multi-clip", async (req, res) => {
  const { clienteId, clipes, width, height, fps, captions } = req.body as {
    clienteId?: unknown;
    clipes?: unknown;
    width?: unknown;
    height?: unknown;
    fps?: unknown;
    captions?: unknown;
  };

  if (typeof clienteId !== "string" || !clienteId) {
    res.status(400).json({ error: "clienteId é obrigatório" });
    return;
  }
  if (!Array.isArray(clipes) || clipes.length === 0 || !clipes.every(clipeValido)) {
    res.status(400).json({ error: "clipes precisa ser um array não-vazio de {bucket, storagePath, tipo, trimInMs, trimOutMs, speed?, volume?}" });
    return;
  }
  if (typeof width !== "number" || typeof height !== "number" || typeof fps !== "number") {
    res.status(400).json({ error: "width/height/fps são obrigatórios" });
    return;
  }
  if (captions !== undefined && !cuesValidos(captions)) {
    res.status(400).json({ error: "captions, quando presente, precisa ser um array de {startMs, endMs, text}" });
    return;
  }

  // clipeValido() já confirmou o shape acima (.every) — TS não propaga esse
  // narrowing pro array inteiro fora do `if`, então o cast aqui só nomeia o
  // que já foi validado, não pula validação nenhuma.
  const clipesValidados = clipes as Array<{
    bucket: BucketPermitido;
    storagePath: string;
    tipo: "video" | "image";
    trimInMs: number;
    trimOutMs: number;
    speed?: number;
    volume?: number;
  }>;

  const { data: job, error: erroInsert } = await supabase.from("render_jobs").insert({ status: "queued" }).select("id").single();
  if (erroInsert || !job) {
    res.status(500).json({ error: `Falha ao criar job de render: ${erroInsert?.message ?? "erro desconhecido"}` });
    return;
  }

  res.status(202).json({ jobId: job.id });

  // Nunca await aqui — a resposta já foi enviada, o processamento continua
  // no mesmo processo (fire-and-forget). Erro vira status "failed" na
  // linha do job, nunca uma exception não tratada derrubando o processo.
  void processarFinalMultiClip(job.id as string, {
    clienteId,
    clipes: clipesValidados,
    width,
    height,
    fps,
    captions: captions as CaptionCueSimples[] | undefined,
  }).catch((err) => {
    // processarFinalMultiClip já captura e grava tudo internamente — isso
    // aqui é só o último cinto de segurança (nunca deve disparar de
    // verdade) pra garantir que NADA vira unhandled rejection e derruba o
    // processo, mesmo que um bug futuro reintroduza um caminho sem catch.
    console.error(`processarFinalMultiClip: erro não capturado internamente para o job ${job.id}:`, err);
  });
});

renderRouter.get("/final-multi-clip/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { data: job, error } = await supabase.from("render_jobs").select("status, result, error").eq("id", jobId).single();
  if (error || !job) {
    res.status(404).json({ error: "job não encontrado" });
    return;
  }
  res.json(job);
});
