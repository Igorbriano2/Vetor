// Compila os args do ffmpeg pro RENDER FINAL de verdade (Parte 4/5 do
// pipeline) — pura, sem I/O, testável sem o binário instalado (mesmo
// princípio de proxy.ts). Sempre usa o arquivo ORIGINAL enviado pelo
// cliente, nunca o proxy (proxy é só pra edição leve na timeline, ver
// comentário em proxy.ts) — mais qualidade no entregável final.
//
// Escopo desta rodada (FASE 2 do plano de reconciliação): 1 clip de vídeo
// com trim (corte simples) + legendas opcionais queimadas via filtro
// `subtitles` (a fonte de verdade EDITÁVEL continua sendo os cues em
// video_projects.timeline_json.captions — isso aqui só produz o MP4
// entregável, nunca substitui os cues editáveis). Multi-clip/multi-track
// (concat, transições, mixagem de áudio) fica pra Fase 4 do prompt mestre.

export interface OpcoesRenderFinal {
  inputPath: string;
  outputPath: string;
  trimInMs: number;
  trimOutMs: number;
  // Caminho de um .srt já escrito em disco (ver legendas.ts) — undefined
  // quando não há nenhuma legenda pra essa peça (nunca queima um SRT vazio).
  legendasSrtPath?: string;
}

// O filtro `subtitles=` do ffmpeg usa `:` como separador de opções do
// próprio filtro — um caminho de arquivo com `:` (ex: "C:\..." no Windows,
// ou só coincidência no path) precisa escapar, senão o ffmpeg interpreta
// errado o argumento. `\` também precisa escapar primeiro (senão dobra o
// escape do `:` depois).
function escaparCaminhoParaFiltroSubtitles(caminho: string): string {
  return caminho.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

export function montarArgsFfmpegRenderFinal(opcoes: OpcoesRenderFinal): string[] {
  const trimInSeg = (opcoes.trimInMs / 1000).toFixed(3);
  const duracaoSeg = ((opcoes.trimOutMs - opcoes.trimInMs) / 1000).toFixed(3);

  const args = ["-y", "-i", opcoes.inputPath, "-ss", trimInSeg, "-t", duracaoSeg];

  if (opcoes.legendasSrtPath) {
    args.push("-vf", `subtitles=${escaparCaminhoParaFiltroSubtitles(opcoes.legendasSrtPath)}`);
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    opcoes.outputPath,
  );

  return args;
}
