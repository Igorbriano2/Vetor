// Gera um arquivo .srt real a partir de cues de legenda (mesmo formato
// CaptionCue de apps/painel/src/lib/video/timelineTypes.ts, versão mínima
// aqui: id não importa pro SRT, só startMs/endMs/text) — pura, sem I/O,
// testável sem o binário do ffmpeg. Quem escreve o arquivo em disco é a
// rota (routes/render.ts), igual ao padrão de proxy.ts/sceneDetect.ts.

export interface CaptionCueSimples {
  startMs: number;
  endMs: number;
  text: string;
}

function formatarTimestampSrt(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const horas = Math.floor(total / 3_600_000);
  const minutos = Math.floor((total % 3_600_000) / 60_000);
  const segundos = Math.floor((total % 60_000) / 1_000);
  const milissegundos = total % 1_000;
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(horas)}:${pad(minutos)}:${pad(segundos)},${pad(milissegundos, 3)}`;
}

// Formato SRT padrão: "1\nHH:MM:SS,mmm --> HH:MM:SS,mmm\ntexto\n\n" por cue,
// numerado a partir de 1 na ordem em que os cues chegam (nunca reordena —
// quem decide a ordem é quem monta os cues, essa função só formata).
export function montarSrtDeLegendas(cues: CaptionCueSimples[]): string {
  return cues
    .map((cue, i) => `${i + 1}\n${formatarTimestampSrt(cue.startMs)} --> ${formatarTimestampSrt(cue.endMs)}\n${cue.text}\n`)
    .join("\n");
}
