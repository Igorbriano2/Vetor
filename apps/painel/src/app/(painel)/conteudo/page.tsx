import { redirect } from "next/navigation";

// Fase 0/1 do Vetor Manager — decisão explícita (não deixar rota órfã):
// /conteudo nunca teve entrada no menu (papel já coberto por Design/
// Videomaker como peças) e a tabela conteudo_social tem 0 linhas em
// produção. Vira redirect pra Criações em vez de ficar solta fora do
// menu de quatro áreas. Rota antiga preservada, nunca removida.
export default function ConteudoPageRedirect() {
  redirect("/criacoes");
}
