import { redirect } from "next/navigation";

// Fase 1 do Vetor Manager — /dashboard virou /vetor (área 1 do menu de
// quatro áreas). Rota antiga preservada como redirect, nunca removida.
export default function DashboardPageRedirect() {
  redirect("/vetor");
}
