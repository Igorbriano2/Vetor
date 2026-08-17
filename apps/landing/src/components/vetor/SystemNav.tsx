"use client";

import { useEffect, useState } from "react";
import { StatusDot, VetorMark } from "./system";

const LINKS = [
  { href: "#arquitetura", label: "CAPABILITIES" },
  { href: "#ciclo", label: "HOW IT WORKS" },
  { href: "#planos", label: "PRICING" },
  { href: "#faq", label: "FAQ" },
];

export function SystemNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        aria-label="Navegação principal"
        className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-2xl px-3 py-2.5 transition-all duration-300 sm:px-4 ${
          scrolled ? "panel" : "border border-transparent"
        }`}
      >
        <a
          href="#topo"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <VetorMark />
        </a>

        <div className="hidden items-center gap-6 md:flex">
          <span className="mono-label flex items-center gap-2">
            <StatusDot /> system status · online
          </span>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="mono-label transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#ativar"
            className="hover-pop inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-semibold tracking-wide text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ENTRAR NO SISTEMA
          </a>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <a
            href="#ativar"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[0.7rem] font-semibold tracking-wide text-primary-foreground"
          >
            ENTRAR
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="vetor-menu"
            aria-label="Abrir menu"
            className="grid size-9 place-items-center rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {open ? (
        <div
          id="vetor-menu"
          className="panel animate-pop-in mx-auto mt-2 w-full max-w-6xl rounded-2xl p-4 md:hidden"
        >
          <span className="mono-label flex items-center gap-2">
            <StatusDot /> system status · online
          </span>
          <ul className="mt-3 space-y-3">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="mono-label block py-1 hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
