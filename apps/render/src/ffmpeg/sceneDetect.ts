// Detecção de cortes (mudanças bruscas de cena) via o filtro nativo
// "scene" do ffmpeg — técnica padrão (sem dependência externa de visão
// computacional): compara frames consecutivos e marca quando a diferença
// passa do threshold. Só detecta CORTES SECOS de verdade; nunca classifica
// fade/wipe/dissolve — por isso o ReferenceVideoProfile.transitionsUsed
// sempre reporta só "cut" (ver referenceVideoAnalysis.ts), nunca inventa
// tipos de transição que essa técnica não consegue diferenciar.
export function montarArgsFfmpegSceneDetect(inputPath: string, threshold = 0.4): string[] {
  return ["-i", inputPath, "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"];
}

// O ffmpeg imprime uma linha "showinfo" por frame selecionado, sempre com
// "pts_time:X.XXXXXX" — extrai esses timestamps em ms. Pura, testável com
// stderr real capturado de uma execução (ver sceneDetect.test.ts).
export function parseTimestampsDeCorteMs(stderr: string): number[] {
  const cortes: number[] = [];
  const regex = /pts_time:(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    cortes.push(Math.round(Number.parseFloat(match[1]) * 1000));
  }
  return cortes;
}
