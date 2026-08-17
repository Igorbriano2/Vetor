export type CoreState =
  | "idle"
  | "listening"
  | "understanding"
  | "planning"
  | "executing"
  | "approval"
  | "success";

const STATE_COLOR: Record<CoreState, string> = {
  idle: "var(--cyan)",
  listening: "var(--cyan)",
  understanding: "var(--electric)",
  planning: "var(--electric)",
  executing: "var(--cyan)",
  approval: "var(--amber)",
  success: "var(--amber)",
};

const STATE_LABEL: Record<CoreState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  understanding: "UNDERSTANDING",
  planning: "PLANNING",
  executing: "EXECUTING",
  approval: "AWAITING APPROVAL",
  success: "MISSION READY",
};

export function VetorCore({
  state = "idle",
  className = "",
}: {
  state?: CoreState;
  className?: string;
}) {
  const c = STATE_COLOR[state];
  const energetic = state !== "idle";

  return (
    <div
      className={`relative aspect-square w-full ${className}`}
      role="img"
      aria-label={`Núcleo VETOR — estado ${STATE_LABEL[state]}`}
    >
      <div
        className="absolute inset-[18%] rounded-full blur-3xl transition-colors duration-700 animate-breathe"
        style={{ background: `radial-gradient(circle, color-mix(in oklab, ${c} 32%, transparent), transparent 70%)` }}
        aria-hidden="true"
      />
      <svg viewBox="0 0 400 400" className="relative size-full" aria-hidden="true">
        <defs>
          <radialGradient id="vetor-core-fill">
            <stop offset="0%" stopColor={c} stopOpacity="0.95" />
            <stop offset="55%" stopColor={c} stopOpacity="0.25" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* retícula */}
        <g stroke={c} strokeOpacity="0.1">
          <circle cx="200" cy="200" r="190" fill="none" />
          <circle cx="200" cy="200" r="150" fill="none" />
          <line x1="200" y1="6" x2="200" y2="394" />
          <line x1="6" y1="200" x2="394" y2="200" />
        </g>

        {/* anéis orbitais */}
        <g style={{ transformOrigin: "200px 200px" }} className="animate-spin-slow">
          <ellipse
            cx="200"
            cy="200"
            rx="168"
            ry="62"
            fill="none"
            stroke={c}
            strokeOpacity="0.35"
            strokeDasharray="3 10"
          />
          <circle cx="368" cy="200" r="4" fill={c} />
        </g>
        <g style={{ transformOrigin: "200px 200px", transform: "rotate(58deg)" }} className="animate-spin-slower">
          <ellipse cx="200" cy="200" rx="140" ry="140" fill="none" stroke={c} strokeOpacity="0.18" />
          <circle cx="340" cy="200" r="3" fill={c} opacity="0.8" />
        </g>
        <g style={{ transformOrigin: "200px 200px", transform: "rotate(-32deg)" }} className="animate-spin-slow">
          <ellipse
            cx="200"
            cy="200"
            rx="118"
            ry="46"
            fill="none"
            stroke="var(--electric)"
            strokeOpacity="0.4"
          />
          <circle cx="82" cy="200" r="3.5" fill="var(--electric)" />
        </g>

        {/* pulsos de dados */}
        <g
          fill="none"
          stroke={c}
          strokeOpacity={energetic ? 0.55 : 0.28}
          strokeWidth="1"
          strokeDasharray="14 220"
          className="animate-dash"
        >
          <circle cx="200" cy="200" r="96" />
          <circle cx="200" cy="200" r="126" />
          <circle cx="200" cy="200" r="158" />
        </g>

        {/* núcleo */}
        <circle cx="200" cy="200" r="78" fill="url(#vetor-core-fill)" className="animate-breathe" />
        <circle cx="200" cy="200" r="46" fill="none" stroke={c} strokeOpacity="0.6" />
        <circle cx="200" cy="200" r="22" fill={c} fillOpacity="0.9" />
        <path
          d="M182 194l14 20 24-36"
          fill="none"
          stroke="var(--void)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center">
        <span
          className="mono-label rounded-full border px-3 py-1"
          style={{ color: c, borderColor: `color-mix(in oklab, ${c} 40%, transparent)` }}
        >
          {STATE_LABEL[state]}
        </span>
      </div>
    </div>
  );
}
