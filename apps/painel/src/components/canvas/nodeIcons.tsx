import type { TipoNode } from "@/lib/canvas/types";

// Design V2 (auditoria Gravyx) — cada node do canvas deles tem um ícone
// próprio num badge circular no cabeçalho, o que ajuda a escanear o grafo
// rápido sem ler texto. Aqui não copiamos os ícones/cores deles (marca
// alheia) — desenhamos um traço geométrico simples e consistente (24x24,
// stroke atual, sem preenchimento), um por TipoNode, coerente com o resto
// do produto.
const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const ICONE_TIPO: Record<TipoNode, React.ReactNode> = {
  briefing: (
    <svg {...props}>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  ),
  arquivo: (
    <svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17l5-5 4 4 3-3 4 4" />
    </svg>
  ),
  referencia: (
    <svg {...props}>
      <path d="M6 3.5h12v18l-6-4-6 4z" />
    </svg>
  ),
  brandkit: (
    <svg {...props}>
      <circle cx="8" cy="8" r="4" />
      <circle cx="16" cy="16" r="4" />
      <path d="M11 8h2M16 11v2" />
    </svg>
  ),
  prompt_visual: (
    <svg {...props}>
      <path d="M4 5h16v10H9l-4 4v-4H4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  direcao_arte: (
    <svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  ),
  provider: (
    <svg {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" />
    </svg>
  ),
  resultado: (
    <svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  ),
  scene_graph: (
    <svg {...props}>
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="19" cy="18" r="1.6" />
    </svg>
  ),
  critica: (
    <svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  ),
  aprovacao: (
    <svg {...props}>
      <path d="M4 12.5l5 5 11-11" />
    </svg>
  ),
  entrega: (
    <svg {...props}>
      <path d="M3.5 8l8.5-4.5L20.5 8 12 12.5z" />
      <path d="M3.5 8v8l8.5 4.5V12.5M20.5 8v8L12 20.5" />
    </svg>
  ),
};
