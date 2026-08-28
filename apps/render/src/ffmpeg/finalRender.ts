// Compila os args do ffmpeg pro RENDER FINAL de verdade (Parte 4/5 do
// pipeline) — pura, sem I/O, testável sem o binário instalado (mesmo
// princípio de proxy.ts). Sempre usa o arquivo ORIGINAL enviado pelo
// cliente, nunca o proxy (proxy é só pra edição leve na timeline, ver
// comentário em proxy.ts) — mais qualidade no entregável final.
//
// montarArgsFfmpegRenderFinal (abaixo) continua existindo pro caso de 1
// trim simples — ainda usado pra gerar um trecho leve pra transcrição
// (ver specialistRunner.ts, estágio "captions"), que nunca precisou da
// timeline inteira. montarArgsFfmpegConcatMultiClip (fim do arquivo) é a
// implementação real da Fase 4 do prompt mestre — concatena TODOS os
// clipes de TODAS as faixas de vídeo/imagem da timeline, cada um com seu
// próprio trim/speed/volume, é o que o estágio "final_render" usa quando
// a timeline tem mais de 1 clipe.

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

// Achado ao vivo (redesign, pedido explícito de tela "igual CapCut/
// Premiere"): o filtro `subtitles=` sem nenhum force_style usa o padrão
// cru do libass — texto branco pequeno sem fundo, ilegível em cima de
// vídeo claro e nada parecido com a legenda em caixa que toda rede social
// usa hoje. force_style aplica direto no libass (o mesmo motor que já
// renderiza o .srt, nenhuma dependência nova): texto maior e em negrito,
// caixa semitransparente atrás (BorderStyle=3 = modo "caixa opaca", nunca
// só contorno), ancorado embaixo com respiro da borda. Sem FontName de
// propósito — não dependemos de uma fonte específica estar instalada no
// container do render, o fallback do fontconfig já resolve pra uma fonte
// sans real.
const ESTILO_LEGENDA_FORCADO =
  "FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=70,Alignment=2";

function filtroSubtitlesComEstilo(srtPath: string): string {
  return `subtitles=${escaparCaminhoParaFiltroSubtitles(srtPath)}:force_style='${ESTILO_LEGENDA_FORCADO}'`;
}

export function montarArgsFfmpegRenderFinal(opcoes: OpcoesRenderFinal): string[] {
  const trimInSeg = (opcoes.trimInMs / 1000).toFixed(3);
  const duracaoSeg = ((opcoes.trimOutMs - opcoes.trimInMs) / 1000).toFixed(3);

  const args = ["-y", "-i", opcoes.inputPath, "-ss", trimInSeg, "-t", duracaoSeg];

  if (opcoes.legendasSrtPath) {
    args.push("-vf", filtroSubtitlesComEstilo(opcoes.legendasSrtPath));
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

// O filtro `atempo` do ffmpeg só aceita fatores entre 0.5 e 2.0 — um clipe
// em câmera lenta extrema (0.25x) ou acelerado além de 2x precisa de vários
// `atempo` encadeados, nunca um valor fora do intervalo suportado (o ffmpeg
// rejeita o filtro nesse caso, silenciosamente quebrando o áudio do clipe).
// Achado em pesquisa (auditoria de ferramentas de edição orientadas a IA,
// ver docs/relatorio-manha.md) — cada corte na timeline vira um salto
// abrupto de amplitude entre o fim de um clipe e o começo do próximo, e
// isso se ouve como um "pop"/estalo audível, mesmo em cortes tecnicamente
// corretos. Fade de 30ms em cada ponta do áudio de todo clipe de vídeo
// (curto o bastante pra nunca ser percebido como fade, longo o bastante
// pra eliminar o clique) resolve isso — mesmo princípio que editores de
// vídeo profissionais aplicam por padrão em todo corte.
const FADE_CORTE_SEGUNDOS = 0.03;

export function montarFiltroFadeDeCorte(duracaoAudioSeg: number): string {
  const fade = Math.min(FADE_CORTE_SEGUNDOS, duracaoAudioSeg / 2);
  const inicioFadeOut = Math.max(0, duracaoAudioSeg - fade);
  return `afade=t=in:st=0:d=${fade.toFixed(3)},afade=t=out:st=${inicioFadeOut.toFixed(3)}:d=${fade.toFixed(3)}`;
}

export function decomporSpeedEmCadeiaAtempo(speed: number): string[] {
  if (!(speed > 0)) throw new Error(`speed inválido pra atempo: ${speed}`);
  const fatores: number[] = [];
  let restante = speed;
  while (restante > 2) {
    fatores.push(2);
    restante /= 2;
  }
  while (restante < 0.5) {
    fatores.push(0.5);
    restante /= 0.5;
  }
  fatores.push(restante);
  return fatores.map((f) => `atempo=${f.toFixed(4)}`);
}

export interface ClipeParaConcat {
  inputPath: string;
  // Imagem entra via -loop 1 (sem trilha de áudio própria — um clipe de
  // imagem na timeline vira silêncio real no trecho, nunca inventa áudio).
  // "speed" não se aplica a um frame estático, é ignorado nesse caso.
  tipo: "video" | "image";
  trimInMs: number;
  trimOutMs: number;
  speed: number;
  volume: number;
}

export interface OpcoesRenderFinalMultiClip {
  clipes: ClipeParaConcat[];
  outputPath: string;
  legendasSrtPath?: string;
  width: number;
  height: number;
  fps: number;
}

// Implementação real da Fase 4 do prompt mestre: concatena TODOS os clipes
// de TODAS as faixas de vídeo/imagem da timeline, na ordem dada, cada um
// com seu próprio trim/speed/volume — não só o primeiro clipe (era essa a
// limitação documentada de montarArgsFfmpegRenderFinal acima). Sempre via
// filter_complex, nunca o demuxer `concat` (que exige mesmo codec/
// resolução/fps entre os arquivos de origem — não garantido aqui, cada
// clipe pode vir de um asset diferente). scale+pad+setsar+fps em CADA
// clipe força todos pro mesmo formato antes do concat — o filtro `concat`
// falha ("sizes not the same") se os segmentos não baterem exatamente.
export function montarArgsFfmpegConcatMultiClip(opcoes: OpcoesRenderFinalMultiClip): string[] {
  if (opcoes.clipes.length === 0) throw new Error("montarArgsFfmpegConcatMultiClip chamado sem nenhum clipe.");

  const args: string[] = ["-y"];
  const filtros: string[] = [];
  const labelsConcat: string[] = [];

  opcoes.clipes.forEach((clipe, i) => {
    const trimInSeg = clipe.trimInMs / 1000;
    const trimOutSeg = clipe.trimOutMs / 1000;
    const duracaoSeg = trimOutSeg - trimInSeg;
    const formato = `scale=${opcoes.width}:${opcoes.height}:force_original_aspect_ratio=decrease,pad=${opcoes.width}:${opcoes.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${opcoes.fps}`;

    if (clipe.tipo === "image") {
      args.push("-loop", "1", "-t", duracaoSeg.toFixed(3), "-i", clipe.inputPath);
      filtros.push(`[${i}:v]${formato},setpts=PTS-STARTPTS[v${i}]`);
      // Fonte de silêncio gerada (lavfi) — nunca um input real: o concat
      // exige exatamente 1 stream de áudio por segmento, e imagem não tem
      // trilha própria pra fornecer.
      filtros.push(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duracaoSeg.toFixed(3)}[a${i}]`);
    } else {
      args.push("-i", clipe.inputPath);
      const cadeiaAtempo = clipe.speed !== 1 ? `${decomporSpeedEmCadeiaAtempo(clipe.speed).join(",")},` : "";
      // atempo já mudou a duração real do áudio (2x mais rápido = metade
      // da duração) — o fade de corte precisa ser calculado em cima da
      // duração PÓS-speed, não da duração do trim original, senão o
      // fade-out cai fora (ou no meio) do trecho de áudio de verdade.
      const duracaoAudioPosSpeedSeg = duracaoSeg / clipe.speed;
      const fadeDeCorte = montarFiltroFadeDeCorte(duracaoAudioPosSpeedSeg);
      filtros.push(`[${i}:v]trim=start=${trimInSeg.toFixed(3)}:end=${trimOutSeg.toFixed(3)},setpts=(PTS-STARTPTS)/${clipe.speed},${formato}[v${i}]`);
      filtros.push(`[${i}:a]atrim=start=${trimInSeg.toFixed(3)}:end=${trimOutSeg.toFixed(3)},asetpts=PTS-STARTPTS,${cadeiaAtempo}volume=${clipe.volume.toFixed(3)},${fadeDeCorte}[a${i}]`);
    }

    labelsConcat.push(`[v${i}][a${i}]`);
  });

  filtros.push(`${labelsConcat.join("")}concat=n=${opcoes.clipes.length}:v=1:a=1[vout][aout]`);

  let mapaVideo = "[vout]";
  if (opcoes.legendasSrtPath) {
    filtros.push(`[vout]${filtroSubtitlesComEstilo(opcoes.legendasSrtPath)}[vlegendado]`);
    mapaVideo = "[vlegendado]";
  }

  args.push("-filter_complex", filtros.join(";"));
  args.push("-map", mapaVideo, "-map", "[aout]");
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
