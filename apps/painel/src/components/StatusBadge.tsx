const GRUPO: Record<string, "info" | "decisao" | "sucesso" | "risco"> = {
  novo: "info",
  rascunho: "info",
  em_andamento: "info",
  aguardando_aprovacao: "decisao",
  pendente_aprovacao: "decisao",
  concluida: "sucesso",
  aprovada: "sucesso",
  publicada: "sucesso",
  cancelada: "risco",
  rejeitada: "risco",
  // conteudo_social (supabase/migrations/0001_init.sql) usa formas masculinas.
  aprovado: "sucesso",
  agendado: "info",
  publicado: "sucesso",
  // Status de missão (supabase/migrations/0004_missions.sql) — mesmo vocabulário
  // visual, chaves em inglês porque é o que fica gravado no banco.
  draft: "info",
  understanding: "info",
  awaiting_clarification: "decisao",
  planned: "info",
  awaiting_approval: "decisao",
  queued: "info",
  running: "info",
  blocked: "risco",
  completed: "sucesso",
  failed: "risco",
  cancelled: "risco",
  archived: "info",
};

const CORES: Record<"info" | "decisao" | "sucesso" | "risco", string> = {
  info: "border-menta/30 bg-menta/10 text-menta",
  decisao: "border-ambar/40 bg-ambar/10 text-ambar animate-pulse",
  sucesso: "border-menta/30 bg-menta/10 text-menta",
  risco: "border-coral/40 bg-coral/10 text-coral",
};

const ROTULOS: Record<string, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
  rascunho: "Rascunho",
  pendente_aprovacao: "Pendente de aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  publicada: "Publicada",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
  draft: "Rascunho",
  understanding: "Entendendo",
  awaiting_clarification: "Aguardando esclarecimento",
  planned: "Planejada",
  awaiting_approval: "Aguardando aprovação",
  queued: "Na fila",
  running: "Em execução",
  blocked: "Bloqueada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
  archived: "Arquivada",
};

export default function StatusBadge({ status }: { status: string }) {
  const grupo = GRUPO[status] ?? "info";
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wide ${CORES[grupo]}`}
    >
      {ROTULOS[status] ?? status}
    </span>
  );
}
