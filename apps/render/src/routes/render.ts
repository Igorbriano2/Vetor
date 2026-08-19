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
