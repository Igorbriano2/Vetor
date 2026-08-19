// Compila os args do ffmpeg pra gerar um proxy de edição — pura, sem I/O,
// testável sem precisar do binário instalado. A execução de verdade (spawn)
// fica em executar.ts, que roda o ffmpeg real (não dá pra unit-testar sem
// mockar o processo — verificado ao vivo, ver PROCESSO da spec: "nunca
// declara funcionalidade pronta sem teste e artefato verificável").

export interface OpcoesProxy {
  inputPath: string;
  outputPath: string;
  // Altura máxima do proxy — a largura escala mantendo o aspect ratio
  // (nunca distorce). 480p é suficiente pra edição na timeline; o render
  // final (Parte 4/5) sempre usa o arquivo original, nunca o proxy.
  alturaMaxima?: number;
}

export function montarArgsFfmpegProxy(opcoes: OpcoesProxy): string[] {
  const altura = opcoes.alturaMaxima ?? 480;
  return [
    "-y",
    "-i",
    opcoes.inputPath,
    // -2 mantém a largura sempre par (exigência do libx264) escalando
    // proporcionalmente à altura fixa — nunca estica/distorce o vídeo.
    "-vf",
    `scale=-2:${altura}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    opcoes.outputPath,
  ];
}
