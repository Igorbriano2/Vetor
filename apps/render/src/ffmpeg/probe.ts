// Compila os args do ffprobe pra ler a duração real do arquivo — pura,
// testável sem o binário. Sem isso, um clip novo na timeline nasceria com
// uma duração inventada (achado do editor no painel: task #78 tinha que
// usar um padrão fixo de 4-6s por falta dessa informação real).
export function montarArgsFfprobeDuracao(inputPath: string): string[] {
  return ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputPath];
}
