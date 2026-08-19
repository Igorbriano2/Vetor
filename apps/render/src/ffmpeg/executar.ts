import { spawn } from "node:child_process";

export class FfmpegError extends Error {}

// Roda o binário ffmpeg de verdade — nunca simula sucesso. Se o processo
// sair com código != 0, o erro carrega o final do stderr (onde o ffmpeg
// põe a causa real, ex: codec não suportado, arquivo corrompido).
export function executarFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const processo = spawn("ffmpeg", args);
    let stderr = "";

    processo.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processo.on("error", (err) => {
      reject(new FfmpegError(`Falha ao iniciar o ffmpeg: ${err.message}`));
    });

    processo.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new FfmpegError(`ffmpeg saiu com código ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

// Roda o ffmpeg e devolve o stderr COMPLETO em caso de sucesso — usado
// pelos filtros que só reportam resultado por lá (showinfo/volumedetect,
// ver sceneDetect.ts e audioVolume.ts). Diferente de executarFfmpeg (que só
// usa stderr pra montar a mensagem de erro), aqui o stderr É o dado.
export function executarFfmpegCapturandoStderr(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const processo = spawn("ffmpeg", args);
    let stderr = "";

    processo.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processo.on("error", (err) => {
      reject(new FfmpegError(`Falha ao iniciar o ffmpeg: ${err.message}`));
    });

    processo.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new FfmpegError(`ffmpeg saiu com código ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

// Lê a duração real do arquivo em ms via ffprobe — nunca inventa duração
// pra um clip novo (ver probe.ts).
export function executarFfprobeDuracaoMs(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const processo = spawn("ffprobe", args);
    let stdout = "";
    let stderr = "";

    processo.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    processo.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processo.on("error", (err) => {
      reject(new FfmpegError(`Falha ao iniciar o ffprobe: ${err.message}`));
    });

    processo.on("close", (code) => {
      if (code !== 0) {
        reject(new FfmpegError(`ffprobe saiu com código ${code}: ${stderr.slice(-2000)}`));
        return;
      }
      const segundos = Number.parseFloat(stdout.trim());
      if (Number.isNaN(segundos)) {
        reject(new FfmpegError(`ffprobe não devolveu uma duração numérica: "${stdout.trim()}"`));
        return;
      }
      resolve(Math.round(segundos * 1000));
    });
  });
}

// Roda o ffprobe e devolve o stdout cru — usado quando a saída não é um
// único número (ex: JSON com width/height/duration, ver probeInfo.ts).
export function executarFfprobeStdout(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const processo = spawn("ffprobe", args);
    let stdout = "";
    let stderr = "";

    processo.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    processo.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processo.on("error", (err) => {
      reject(new FfmpegError(`Falha ao iniciar o ffprobe: ${err.message}`));
    });

    processo.on("close", (code) => {
      if (code !== 0) {
        reject(new FfmpegError(`ffprobe saiu com código ${code}: ${stderr.slice(-2000)}`));
        return;
      }
      resolve(stdout);
    });
  });
}
