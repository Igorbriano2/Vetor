// Extrai um único frame no instante pedido — usado pra montar a amostra
// visual (poucos frames, nunca o vídeo inteiro) enviada ao Claude vision
// na análise do vídeo de referência. Uma chamada por timestamp (via -ss
// antes do -i, seek rápido) é mais confiável que extrair vários frames
// numa passada só e filtrar depois.
export function montarArgsFfmpegExtrairFrame(inputPath: string, atSeconds: number, outputPath: string): string[] {
  return ["-y", "-ss", atSeconds.toFixed(3), "-i", inputPath, "-frames:v", "1", "-q:v", "4", outputPath];
}
