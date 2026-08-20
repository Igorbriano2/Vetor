import { redirect } from "next/navigation";

// Fase 5 do Vetor Manager — Conexões virou a segunda aba de
// /configuracoes/negocio (mesmo ConexoesPainel, sem duplicar lógica).
// Rota antiga preservada como redirect, nunca removida.
export default function ConexoesPageRedirect() {
  redirect("/configuracoes/negocio?aba=conexoes");
}
