"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { ÍCONE_POR_HREF } from "@/components/ui/areaIcons";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

// Navegação por especialista — cada frente da agência (Design, Vídeo,
// Tráfego) tem sua própria área de primeiro nível em vez de ficar escondida
// dentro de "Criações" ou de uma aba. Criações continua existindo como
// biblioteca agregada (galeria de tudo que foi produzido), não como o lugar
// onde o trabalho em si acontece. Nenhuma rota antiga foi removida: todas
// continuam acessíveis por link a partir da área que as absorveu.
const GRUPOS_NAV: Array<{ titulo: string | null; itens: Array<{ href: string; label: string }> }> = [
  {
    titulo: null,
    itens: [
      { href: "/vetor", label: "VETOR" },
      { href: "/estrategia", label: "Estratégia" },
      { href: "/design", label: "Design" },
      { href: "/videomaker", label: "Vídeo" },
      { href: "/social", label: "Social" },
      { href: "/trafego", label: "Tráfego" },
      { href: "/analitico", label: "Analítico" },
      { href: "/criacoes", label: "Criações" },
      { href: "/configuracoes/negocio", label: "Negócio" },
    ],
  },
  {
    // Suíte de IA "estúdio direto" (docs/arquitetura-suite-ia.md) — segundo
    // caminho de criação, paralelo ao fluxo de agente acima. Cresce fase a
    // fase (Fase 3: Imagem; próximas fases acrescentam Vídeo/Voz/3D).
    titulo: "Suíte de IA",
    itens: [
      { href: "/imagem", label: "Imagem" },
      { href: "/video-ia", label: "Vídeo IA" },
      { href: "/voz", label: "Voz" },
    ],
  },
];

// Sub-rotas que continuam existindo fora da área (linkadas a partir do hub
// da área, não deste menu) mas devem acender o mesmo item — ver comentário
// de GRUPOS_NAV acima.
const SUB_ROTAS_DA_AREA: Record<string, string[]> = {
  "/vetor": ["/missoes", "/solicitacoes"],
  "/criacoes": ["/referencias", "/templates", "/entregas"],
};

function ehAtivo(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  const subRotas = SUB_ROTAS_DA_AREA[href] ?? [];
  return subRotas.some((sub) => pathname === sub || pathname.startsWith(`${sub}/`));
}

function VetorMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-menta/30 bg-menta/10">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
          <path d="M4 5l8 14 8-14" stroke="var(--color-menta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div>
        <p className="text-gradient-menta text-sm font-bold tracking-wide">VETOR</p>
      </div>
    </div>
  );
}

// Rail recolhido (Fase 1 do VETOR Manager V2) — usado só na tela /vetor,
// onde o núcleo fullscreen precisa do máximo de espaço horizontal. Mesmos 4
// links, mesma lógica de destaque ativo (ehAtivo), só sem rótulo por
// extenso — nunca uma navegação diferente, só uma apresentação mais
// compacta da mesma.
function RailNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col items-center gap-2">
      {GRUPOS_NAV[0]!.itens.map((item) => {
        const ativo = ehAtivo(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={`flex size-10 items-center justify-center rounded-lg transition ${
              ativo ? "bg-menta/10 text-menta" : "text-areia-2 hover:bg-areia/5 hover:text-areia"
            }`}
          >
            {ÍCONE_POR_HREF[item.href]}
          </Link>
        );
      })}
    </nav>
  );
}

function ListaNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-3">
      {GRUPOS_NAV.map((grupo, i) => (
        <div key={grupo.titulo ?? `grupo-${i}`} className="flex flex-col gap-0.5">
          {grupo.titulo && (
            <p className="mt-1 px-3 font-mono text-[10px] uppercase tracking-widest text-areia/25">{grupo.titulo}</p>
          )}
          {grupo.itens.map((item) => {
            const ativo = ehAtivo(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`mono-label flex items-center gap-2.5 rounded-lg px-3 py-2 transition ${
                  ativo ? "bg-menta/10 text-menta" : "text-areia-2 hover:bg-areia/5 hover:text-areia"
                }`}
              >
                <span className="shrink-0 opacity-80">{ÍCONE_POR_HREF[item.href]}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function SidebarNav({
  orgNome,
  userNome,
  ehAdmin = false,
  workspaceAtivoId = null,
  workspaces = [],
}: {
  orgNome?: string | null;
  userNome?: string | null;
  ehAdmin?: boolean;
  workspaceAtivoId?: string | null;
  workspaces?: Array<{ id: string; nome: string }>;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  // Fase 1 do VETOR Manager V2 — só a tela /vetor recolhe pro rail de
  // ícones (o núcleo fullscreen precisa do espaço); todas as outras áreas
  // continuam com o menu completo, sem mudança nenhuma de comportamento.
  const recolhido = pathname === "/vetor";

  return (
    <>
      {/* Desktop */}
      {recolhido ? (
        <aside className="panel fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center gap-6 overflow-y-auto py-5 lg:flex">
          <Link href="/vetor" aria-label="VETOR" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-menta/30 bg-menta/10">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
              <path d="M4 5l8 14 8-14" stroke="var(--color-menta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <RailNav pathname={pathname} />
          <div className="mt-auto flex flex-col items-center gap-3">
            <span className="relative flex size-2 items-center justify-center" title="Sistema online">
              <span className="absolute inset-0 rounded-full bg-menta animate-core-pulse" />
              <span className="relative size-1.5 rounded-full bg-menta" />
            </span>
            <LogoutButton compact />
          </div>
        </aside>
      ) : (
        <aside className="panel fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto p-5 lg:flex">
          <div>
            <VetorMark />
            {ehAdmin && workspaces.length > 0 ? (
              <WorkspaceSwitcher workspaceAtivoId={workspaceAtivoId} workspaces={workspaces} />
            ) : (
              <p className="mono-label mt-2 truncate">{orgNome ?? "sua empresa"}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="relative flex size-2 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-menta animate-core-pulse" />
                <span className="relative size-1.5 rounded-full bg-menta" />
              </span>
              <span className="mono-label">system online</span>
            </div>
          </div>

          <ListaNav pathname={pathname} />

          <div className="mt-auto space-y-3">
            <div className="space-y-3 border-t border-areia/10 pt-4">
              <p className="mono-label truncate">{userNome ?? "conta"}</p>
              <LogoutButton />
            </div>
          </div>
        </aside>
      )}

      {/* Mobile */}
      <div className="panel sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
        <VetorMark />
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir navegação"
          className="flex size-9 items-center justify-center rounded-lg border border-areia/15 text-areia"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-petroleo/80 backdrop-blur-sm" onClick={() => setAberto(false)} />
          <div className="panel absolute inset-y-0 left-0 flex w-72 flex-col gap-6 overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <VetorMark />
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar navegação"
                className="flex size-8 items-center justify-center rounded-lg border border-areia/15 text-areia"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {ehAdmin && workspaces.length > 0 ? (
              <WorkspaceSwitcher workspaceAtivoId={workspaceAtivoId} workspaces={workspaces} />
            ) : (
              <p className="mono-label -mt-4 truncate">{orgNome ?? "sua empresa"}</p>
            )}
            <ListaNav pathname={pathname} onNavigate={() => setAberto(false)} />
            <div className="mt-auto space-y-3">
              <div className="space-y-3 border-t border-areia/10 pt-4">
                <p className="mono-label truncate">{userNome ?? "conta"}</p>
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
