// Design V2 (prompt "reconstrução seletiva") — Fase 1: a galeria de Criações
// precisa mostrar "Em produção" e "Com falha" como estados reais, não só
// "Concluídas". Isola a regra de classificação (mission_steps.status →
// balde visual) numa função pura testável, mesmo padrão de rotuloDePeca.ts.
export type StatusProgresso = "em_producao" | "com_falha" | null;

const STATUS_EM_PRODUCAO = ["pending", "ready", "running", "awaiting_approval"];
const STATUS_COM_FALHA = ["failed", "blocked"];

export function classificarStatusStep(status: string): StatusProgresso {
  if (STATUS_COM_FALHA.includes(status)) return "com_falha";
  if (STATUS_EM_PRODUCAO.includes(status)) return "em_producao";
  return null;
}
