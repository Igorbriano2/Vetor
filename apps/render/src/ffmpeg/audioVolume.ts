// Mede o volume médio real do áudio via o filtro "volumedetect" do ffmpeg —
// usado como sinal (heurístico, nunca uma detecção de "é música" de
// verdade) pra classificar energia musical no ReferenceVideoProfile. Não
// existe hoje nenhuma capacidade de separar música de fala/silêncio; é só
// o volume médio em dB do áudio inteiro.
export function montarArgsFfmpegVolumeDetect(inputPath: string): string[] {
  return ["-i", inputPath, "-af", "volumedetect", "-f", "null", "-"];
}

// Extrai "mean_volume: -X.X dB" da saída do volumedetect. Devolve null se o
// arquivo não tiver trilha de áudio (nunca inventa um valor em dB).
export function parseMeanVolumeDb(stderr: string): number | null {
  const match = /mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/.exec(stderr);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}
