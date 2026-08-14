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
