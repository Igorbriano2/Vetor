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
