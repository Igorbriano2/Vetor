export type EstadoCore =
  | "idle"
  | "listening"
  | "understanding"
  | "planning"
  | "executing"
  | "approval"
  | "success"
  | "error";

const COR_ESTADO: Record<EstadoCore, string> = {
  idle: "var(--color-menta)",
  listening: "var(--color-menta)",
  understanding: "var(--color-electric)",
  planning: "var(--color-electric)",
  executing: "var(--color-menta)",
  approval: "var(--color-ambar)",
  success: "var(--color-ambar)",
  error: "var(--color-coral)",
};

const LABEL_ESTADO: Record<EstadoCore, string> = {
  idle: "EM ESPERA",
  listening: "OUVINDO",
  understanding: "ENTENDENDO",
  planning: "PLANEJANDO",
  executing: "EXECUTANDO",
  approval: "AGUARDANDO APROVAÇÃO",
  success: "MISSÃO PRONTA",
  error: "PRECISA DE ATENÇÃO",
};

const MENSAGEM_ESTADO: Record<EstadoCore, string> = {
  idle: "Vetor está de olho no seu negócio",
  listening: "Vetor está ouvindo",
  understanding: "Vetor está entendendo o seu pedido",
  planning: "Vetor está montando o plano",
  executing: "Vetor está executando a missão",
  approval: "Sua decisão é necessária",
  success: "Missão concluída",
  error: "Algo precisa da sua atenção",
};

// Versão compacta: ponto pulsante + rótulo, usada em contextos de pouco espaço
// (cabeçalho do VetorCommandBar). A versão completa é o núcleo orbital em SVG,
// portado de apps/landing/src/components/vetor/VetorCore.tsx pra manter a mesma
// identidade visual entre a landing e o cockpit autenticado.
export default function VetorCore({
  estado = "idle",
  compact = false,
  className = "mx-auto w-40",
}: {
  estado?: EstadoCore;
  compact?: boolean;
  className?: string;
}) {
  const cor = COR_ESTADO[estado];

  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-3.5 items-center justify-center">
          <span className="absolute inset-0 rounded-full animate-core-pulse" style={{ background: cor }} />
          <span className="relative size-2.5 rounded-full" style={{ background: cor }} />
        </span>
        <span className="text-sm text-areia/70">{MENSAGEM_ESTADO[estado]}</span>
      </div>
    );
  }

  const energico = estado !== "idle";

  return (
    <div
      className={`relative aspect-square ${className}`}
      role="img"
      aria-label={`Núcleo Vetor — estado ${LABEL_ESTADO[estado]}`}
    >
      <div
        className="absolute inset-[18%] rounded-full blur-3xl transition-colors duration-700 animate-breathe"
        style={{ background: `radial-gradient(circle, color-mix(in oklab, ${cor} 32%, transparent), transparent 70%)` }}
        aria-hidden="true"
      />
      <svg viewBox="0 0 400 400" className="relative size-full" aria-hidden="true">
        <defs>
          <radialGradient id="vetor-core-fill">
            <stop offset="0%" stopColor={cor} stopOpacity="0.95" />
            <stop offset="55%" stopColor={cor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g stroke={cor} strokeOpacity="0.1">
          <circle cx="200" cy="200" r="190" fill="none" />
          <circle cx="200" cy="200" r="150" fill="none" />
          <line x1="200" y1="6" x2="200" y2="394" />
          <line x1="6" y1="200" x2="394" y2="200" />
        </g>

        <g style={{ transformOrigin: "200px 200px" }} className="animate-spin-slow">
          <ellipse cx="200" cy="200" rx="168" ry="62" fill="none" stroke={cor} strokeOpacity="0.35" strokeDasharray="3 10" />
          <circle cx="368" cy="200" r="4" fill={cor} />
        </g>
        <g style={{ transformOrigin: "200px 200px", transform: "rotate(58deg)" }} className="animate-spin-slower">
          <ellipse cx="200" cy="200" rx="140" ry="140" fill="none" stroke={cor} strokeOpacity="0.18" />
          <circle cx="340" cy="200" r="3" fill={cor} opacity="0.8" />
        </g>
        <g style={{ transformOrigin: "200px 200px", transform: "rotate(-32deg)" }} className="animate-spin-slow">
          <ellipse cx="200" cy="200" rx="118" ry="46" fill="none" stroke="var(--color-electric)" strokeOpacity="0.4" />
          <circle cx="82" cy="200" r="3.5" fill="var(--color-electric)" />
        </g>

        <g
          fill="none"
          stroke={cor}
          strokeOpacity={energico ? 0.55 : 0.28}
          strokeWidth="1"
          strokeDasharray="14 220"
          className="animate-dash"
        >
          <circle cx="200" cy="200" r="96" />
          <circle cx="200" cy="200" r="126" />
          <circle cx="200" cy="200" r="158" />
        </g>

        <circle cx="200" cy="200" r="78" fill="url(#vetor-core-fill)" className="animate-breathe" />
        <circle cx="200" cy="200" r="46" fill="none" stroke={cor} strokeOpacity="0.6" />
        <circle cx="200" cy="200" r="22" fill={cor} fillOpacity="0.9" />
        <path
          d="M182 194l14 20 24-36"
          fill="none"
          stroke="var(--color-petroleo)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center">
        <span
          className="mono-label rounded-full border px-3 py-1"
          style={{ color: cor, borderColor: `color-mix(in oklab, ${cor} 40%, transparent)` }}
        >
          {LABEL_ESTADO[estado]}
        </span>
      </div>
    </div>
  );
}
