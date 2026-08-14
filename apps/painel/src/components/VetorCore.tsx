type EstadoCore = "idle" | "executando" | "aguardando_aprovacao";

const CONFIG: Record<EstadoCore, { texto: string; cor: string; anel: string }> = {
  idle: {
    texto: "Vetor está de olho no seu negócio",
    cor: "bg-menta",
    anel: "bg-menta/40",
  },
  executando: {
    texto: "Executando demandas em andamento",
    cor: "bg-menta",
    anel: "bg-menta/50",
  },
  aguardando_aprovacao: {
    texto: "Sua decisão é necessária",
    cor: "bg-ambar",
    anel: "bg-ambar/50",
  },
};

export default function VetorCore({
  estado = "idle",
  compact = false,
}: {
  estado?: EstadoCore;
  compact?: boolean;
}) {
  const config = CONFIG[estado];
  const tamanhoNucleo = compact ? "size-2.5" : "size-3.5";
  const tamanhoAnel = compact ? "size-2.5" : "size-3.5";

  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex items-center justify-center">
        <span className={`absolute inline-flex ${tamanhoAnel} animate-core-pulse rounded-full ${config.anel}`} />
        <span className={`relative inline-flex ${tamanhoNucleo} rounded-full ${config.cor} shadow-[0_0_12px_currentColor]`} />
      </span>
      {!compact && (
        <span className="font-mono text-xs tracking-wide text-areia/60">{config.texto}</span>
      )}
    </div>
  );
}

export type { EstadoCore };
