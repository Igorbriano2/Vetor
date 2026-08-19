// Sem dependências de next/server nem @supabase/ssr de propósito — usado tanto
// pelo middleware (server) quanto pela página de login (client), e um import
// server-only dentro de um "use client" quebra o build.
//
// Só aceita caminho interno (uma única barra inicial, nunca "//" — que o
// browser trata como protocol-relative pra outro host — e nunca "://"), pra
// nunca deixar ?next= virar open redirect pra fora do painel.
export function caminhoInternoSeguro(next: string | null | undefined): next is string {
  return !!next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://");
}
