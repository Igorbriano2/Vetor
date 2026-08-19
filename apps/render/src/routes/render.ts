import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Router } from "express";
import { supabase } from "../db/supabase.js";
import { montarArgsFfmpegProxy } from "../ffmpeg/proxy.js";
import { executarFfmpeg, FfmpegError } from "../ffmpeg/executar.js";

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

    res.json({ bucket: "artifacts", storagePath: caminhoDestino, bytes: bytesSaida.length });
  } catch (err) {
    const mensagem = err instanceof FfmpegError ? err.message : err instanceof Error ? err.message : "erro desconhecido";
    res.status(500).json({ error: mensagem });
  } finally {
    await rm(pastaTemp, { recursive: true, force: true });
  }
});
