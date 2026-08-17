"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";
import { SectionHeading, SectionShell } from "./system";

type Agente = { id: string; nome: string; desc: string };

const AGENTES: Agente[] = [
  {
    id: "design",
    nome: "DESIGN",
    desc: "Cria as peças visuais dentro da identidade da sua marca — feed, story, anúncio, material impresso.",
  },
  {
    id: "estrategista",
    nome: "ESTRATEGISTA",
    desc: "Planeja o funil, estuda a concorrência e define o rumo da campanha com base em dados, não em achismo.",
  },
  {
    id: "social",
    nome: "SOCIAL MEDIA",
    desc: "Monta o calendário editorial e escreve as legendas no tom de voz da sua marca.",
  },
  {
    id: "video",
    nome: "EDITOR DE VÍDEO",
    desc: "Corta, legenda e formata vídeos para reels, stories e anúncios.",
  },
  {
    id: "copy",
    nome: "COPYWRITER",
    desc: "Escreve os textos — legendas, anúncios, respostas — sem parecer robótico.",
  },
  {
    id: "trafego",
    nome: "GESTOR DE TRÁFEGO",
    desc: "Cria e ajusta campanhas no Meta Ads, com trava automática de custo.",
  },
  {
    id: "atendente",
    nome: "ATENDENTE",
    desc: "Organiza suas demandas pelo WhatsApp 24h por dia, entende texto e áudio.",
  },
];

export function AgentNetwork() {
  const [ativo, setAtivo] = useState<string | null>(null);
  const atual = AGENTES.find((a) => a.id === ativo);
  const R = 165;

  return (
    <SectionShell id="arquitetura" className="border-t border-border/60">
      <SectionHeading
        index="03"
        eyebrow="arquitetura"
        title={
          <>
            Uma agência de verdade tem 7 especialistas.
            <span className="block text-primary">No VETOR, os 7 são agentes de IA.</span>
          </>
        }
        subtitle="Não são ferramentas desconectadas. É uma inteligência operacional que distribui o trabalho e mantém o contexto entre todos os agentes."
      />

      {/* Desktop: diagrama orbital */}
      <Reveal className="relative mx-auto hidden aspect-square w-full max-w-[560px] md:block">
        <svg viewBox="0 0 460 460" className="absolute inset-0 size-full" aria-hidden="true">
          <circle cx="230" cy="230" r={R} fill="none" stroke="var(--cyan)" strokeOpacity="0.12" />
          <circle cx="230" cy="230" r={R - 55} fill="none" stroke="var(--cyan)" strokeOpacity="0.08" />
          {AGENTES.map((a, i) => {
            const ang = (i / AGENTES.length) * Math.PI * 2 - Math.PI / 2;
            const x = 230 + Math.cos(ang) * R;
            const y = 230 + Math.sin(ang) * R;
            const on = ativo === a.id;
            return (
              <line
                key={a.id}
                x1="230"
                y1="230"
                x2={x}
                y2={y}
                stroke="var(--cyan)"
                strokeOpacity={on ? 0.85 : 0.2}
                strokeWidth={on ? 1.6 : 1}
                strokeDasharray="4 8"
                className="animate-dash"
              />
            );
          })}
          <circle cx="230" cy="230" r="62" fill="var(--surface)" stroke="var(--cyan)" strokeOpacity="0.4" />
          <circle cx="230" cy="230" r="86" fill="none" stroke="var(--cyan)" strokeOpacity="0.15" className="animate-breathe" />
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <span className="text-center">
            <span className="block text-lg font-semibold tracking-[0.24em] text-primary">VETOR</span>
            <span className="mono-label block text-[0.55rem]">general intelligence</span>
          </span>
        </div>

        {AGENTES.map((a, i) => {
          const ang = (i / AGENTES.length) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + (Math.cos(ang) * R * 100) / 460;
          const y = 50 + (Math.sin(ang) * R * 100) / 460;
          const on = ativo === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onMouseEnter={() => setAtivo(a.id)}
              onFocus={() => setAtivo(a.id)}
              onMouseLeave={() => setAtivo((c) => (c === a.id ? null : c))}
              onBlur={() => setAtivo((c) => (c === a.id ? null : c))}
              aria-describedby="agente-desc"
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 font-mono text-[0.62rem] tracking-[0.16em] whitespace-nowrap transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on
                  ? "border-primary bg-primary/15 text-primary shadow-glow"
                  : "border-border bg-surface/80 text-muted-foreground"
              }`}
            >
              {a.nome}
            </button>
          );
        })}
      </Reveal>

      <p
        id="agente-desc"
        aria-live="polite"
        className="mx-auto mt-8 hidden max-w-xl text-center text-sm leading-relaxed text-muted-foreground md:block"
      >
        {atual ? atual.desc : "Passe o mouse ou navegue pelos agentes para ver o papel de cada um."}
      </p>

      {/* Mobile: lista acessível */}
      <ul className="grid gap-3 md:hidden">
        {AGENTES.map((a, i) => (
          <Reveal as="li" key={a.id} delay={i * 50}>
            <div className="panel hover-lift rounded-xl p-4">
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-primary">{a.nome}</span>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </SectionShell>
  );
}
