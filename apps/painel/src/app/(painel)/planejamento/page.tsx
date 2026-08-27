import { redirect } from "next/navigation";

// Reorganização de menus — /planejamento foi absorvido inteiro por
// /estrategia (mesma base de dados de fundo: artifacts type=plan gerados
// pelo agente estratégia; calendário editorial, que também vivia aqui
// duplicado, ficou só em /social). Redirect, não remoção de rota, pra não
// quebrar link antigo salvo por algum cliente.
export default function PlanejamentoPage() {
  redirect("/estrategia");
}
