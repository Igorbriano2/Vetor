"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Núcleo VETOR" },
  { href: "/missoes", label: "Missões" },
  { href: "/solicitacoes", label: "Solicitações" },
  { href: "/planejamento", label: "Planejamento" },
  { href: "/trafego", label: "Tráfego" },
  { href: "/conteudo", label: "Conteúdo" },
  { href: "/entregas", label: "Entregas" },
  { href: "/insights", label: "Insights" },
  { href: "/configuracoes/negocio", label: "Negócio" },
];

function ehAtivo(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
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
        <p className="text-sm font-bold tracking-wide text-areia">VETOR</p>
      </div>
    </div>
  );
}

function ListaNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const ativo = ehAtivo(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`mono-label rounded-lg px-3 py-2 transition ${
              ativo ? "bg-menta/10 text-menta" : "text-areia-2 hover:bg-areia/5 hover:text-areia"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function SidebarNav({
  orgNome,
  userNome,
}: {
  orgNome?: string | null;
  userNome?: string | null;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="panel fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto p-5 lg:flex">
        <div>
          <VetorMark />
          <p className="mono-label mt-2 truncate">{orgNome ?? "sua empresa"}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-menta animate-core-pulse" />
              <span className="relative size-1.5 rounded-full bg-menta" />
            </span>
            <span className="mono-label">system online</span>
          </div>
        </div>

        <ListaNav pathname={pathname} />

        <div className="mt-auto space-y-3 border-t border-areia/10 pt-4">
          <p className="mono-label truncate">{userNome ?? "conta"}</p>
          <LogoutButton />
        </div>
      </aside>

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
            <p className="mono-label -mt-4 truncate">{orgNome ?? "sua empresa"}</p>
            <ListaNav pathname={pathname} onNavigate={() => setAberto(false)} />
            <div className="mt-auto space-y-3 border-t border-areia/10 pt-4">
              <p className="mono-label truncate">{userNome ?? "conta"}</p>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
