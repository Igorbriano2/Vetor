const CORES: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  em_andamento: "bg-amber-100 text-amber-700",
  aguardando_aprovacao: "bg-purple-100 text-purple-700",
  concluida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-red-100 text-red-700",
  rascunho: "bg-slate-100 text-slate-700",
  pendente_aprovacao: "bg-purple-100 text-purple-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  rejeitada: "bg-red-100 text-red-700",
  publicada: "bg-emerald-100 text-emerald-700",
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
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        CORES[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {ROTULOS[status] ?? status}
    </span>
  );
}
