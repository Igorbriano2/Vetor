// Ícone único e discreto por área — extraído de SidebarNav.tsx (fonte
// original) pra ser reutilizado também no cabeçalho de cada página
// (AreaIconBadge abaixo), sem duplicar a definição em dois lugares.
export const ÍCONE_POR_HREF: Record<string, React.ReactNode> = {
  "/vetor": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.5" />
    </svg>
  ),
  "/criacoes": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  "/estrategia": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 8.5l-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  "/design": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M4 16l6.5-6.5a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L8 20H4v-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 6l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  "/videomaker": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="12" height="12" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 10.5l4.3-2.6a.7.7 0 0 1 1.1.6v7l-4.3-2.6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  "/social": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="17" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8.5l1.5 6.5M15 8.5l-1.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  "/trafego": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M4 18V9M11 18V4M18 18v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  "/analitico": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M4 13a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="13" r="1.3" fill="currentColor" />
    </svg>
  ),
  "/configuracoes/negocio": (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 8V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

// Selo de ícone num quadrado arredondado com tint (mesma linguagem visual
// do Gravyx: cada card/seção do "Explore" tem um ícone assim antes do
// título). Usado no cabeçalho de cada página — nunca no lugar do ícone
// da sidebar, só ao lado do H1 de cada área.
export function AreaIconBadge({ href }: { href: string }) {
  const icone = ÍCONE_POR_HREF[href];
  if (!icone) return null;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-menta/25 bg-menta/10 text-menta">
      {icone}
    </span>
  );
}
