import { redirect } from "next/navigation";

// Fase 4 do Vetor Manager — Tráfego virou a segunda aba de /planejamento
// (mesmo TrafegoPainel, sem duplicar lógica). Rota antiga preservada como
// redirect, nunca removida.
export default function TrafegoPageRedirect() {
  redirect("/planejamento?aba=trafego");
}
