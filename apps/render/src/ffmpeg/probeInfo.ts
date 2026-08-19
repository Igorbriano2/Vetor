// Lê duração + dimensões reais do arquivo numa única chamada ao ffprobe —
// pura, testável sem o binário. Usado pelo perfil de vídeo de referência
// (Parte 3), que precisa do aspect ratio real do arquivo original (nunca
// assumido a partir do formato do proxy).
export function montarArgsFfprobeInfo(inputPath: string): string[] {
  return [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    inputPath,
  ];
}

export interface InfoFfprobe {
  durationMs: number;
  width: number;
  height: number;
}

// Faz o parse do JSON de saída — lança se faltar qualquer campo (nunca
// devolve width/height/duration inventados quando o ffprobe não conseguiu
// ler o stream de vídeo, ex: arquivo só de áudio).
export function parseInfoFfprobe(saidaJson: string): InfoFfprobe {
  const dado = JSON.parse(saidaJson) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };

  const stream = dado.streams?.[0];
  const duracaoSegundos = dado.format?.duration ? Number.parseFloat(dado.format.duration) : NaN;

  if (!stream?.width || !stream?.height || Number.isNaN(duracaoSegundos)) {
    throw new Error(`ffprobe não devolveu width/height/duration válidos: ${saidaJson}`);
  }

  return {
    durationMs: Math.round(duracaoSegundos * 1000),
    width: stream.width,
    height: stream.height,
  };
}
