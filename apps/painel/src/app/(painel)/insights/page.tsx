import { redirect } from "next/navigation";

// Fase 0/1 do Vetor Manager — decisão explícita (não deixar rota órfã):
// /insights nunca teve entrada no menu (papel já coberto por Missões —
// atividade dos agentes — e pelos filtros de Entregas/Resultados) e as
// tabelas relatorios/log_agentes têm 0 linhas reais em produção. Vira
// redirect pra Vetor (onde a atividade de missões já é visível) em vez de
// ficar solta fora do menu de quatro áreas. Rota antiga preservada, nunca
// removida.
export default function InsightsPageRedirect() {
  redirect("/vetor");
}
