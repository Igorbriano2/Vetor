"use client";

import { useCallback, useRef, useState } from "react";
import { CommandBar } from "./CommandBar";
import { VetorCore, type CoreState } from "./VetorCore";
import { CtaGhost, CtaPrimary, MonoLabel } from "./system";
import { useVetorActivation } from "./activation/VetorActivationController";

const SIGNAIS = [
  { label: "MARKET SIGNALS", pos: "left-0 top-[12%]" },
  { label: "AUDIENCE MAP", pos: "right-0 top-[24%]" },
  { label: "CAMPAIGN ENGINE", pos: "left-[2%] bottom-[26%]" },
  { label: "CONTENT SYSTEM", pos: "right-[2%] bottom-[14%]" },
  { label: "REVENUE LOOP", pos: "left-1/2 -translate-x-1/2 top-0" },
];

export function Hero() {
  const [state, setState] = useState<CoreState>("idle");
  const handleState = useCallback((s: CoreState) => setState(s), []);
  const { activate, isStarting } = useVetorActivation();
  const coreRef = useRef<HTMLDivElement>(null);

  const startDiagnostic = useCallback(() => {
    const rect = coreRef.current?.getBoundingClientRect();
    const origin = rect
      ? {
          x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
          y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
        }
      : { x: 50, y: 45 };
    activate(origin);
  }, [activate]);

  return (
    <section
      id="topo"
      className="grain relative overflow-hidden px-5 pt-28 pb-16 sm:px-8 sm:pt-36 md:pb-24"
    >
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, color-mix(in oklab, var(--electric) 16%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div>
          <MonoLabel tone="cyan">vetor // the growth operating system</MonoLabel>
          <h1 className="mt-5 text-[2.1rem] leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-[3.3rem]">
            Seu negócio tem um objetivo.
            <span className="block text-primary">O VETOR encontra a rota.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Design, estratégia, social media, edição de vídeo, copywriter, tráfego e atendimento —
            os 7 especialistas de uma agência de verdade, todos agentes de IA coordenados por uma
            única inteligência operacional.
          </p>

          <div className="mt-8">
            <CommandBar onStateChange={handleState} />
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <CtaPrimary
              onClick={startDiagnostic}
              className={isStarting ? "animate-command-pulse" : ""}
            >
              {isStarting ? "INICIANDO DIAGNÓSTICO" : "Iniciar meu diagnóstico"}
            </CtaPrimary>
            <CtaGhost href="#missao">Ver o VETOR em ação</CtaGhost>
          </div>
        </div>

        <div ref={coreRef} className="relative mx-auto w-full max-w-md lg:max-w-none">
          <VetorCore state={state} />
          <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
            {SIGNAIS.map((s, i) => (
              <span
                key={s.label}
                className={`absolute ${s.pos} rounded-full border border-border bg-surface/70 px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.16em] text-muted-foreground backdrop-blur-sm`}
                style={{ animationDelay: `${i * 700}ms` }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
