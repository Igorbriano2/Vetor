"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Reveal } from "./Reveal";
import { MonoLabel, SectionHeading, SectionShell, StatusDot } from "./system";

const EVENTOS = [
  { hora: "09:41", texto: "VETOR identificou o objetivo de crescimento", tone: "cyan" },
  { hora: "09:42", texto: "Estrategista mapeou 3 oportunidades de público", tone: "cyan" },
  { hora: "09:44", texto: "Copywriter gerou 5 ângulos de campanha", tone: "cyan" },
  { hora: "09:46", texto: "Design criou 4 variações de criativo", tone: "cyan" },
  { hora: "09:48", texto: "Governança: revisão necessária", tone: "amber" },
  { hora: "09:49", texto: "Aguardando sua aprovação", tone: "amber" },
] as const;

export function MissionTimeline() {
  const [visiveis, setVisiveis] = useState(0);
  const [aprovado, setAprovado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const scheduled = timers.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        if (reduced) {
          setVisiveis(EVENTOS.length);
          return;
        }
        EVENTOS.forEach((_, i) => {
          scheduled.push(window.setTimeout(() => setVisiveis(i + 1), i * 420));
        });
      },
      { threshold: 0.25 },
    );
    obs.observe(node);
    return () => {
      obs.disconnect();
      scheduled.forEach(clearTimeout);
    };
  }, []);

  return (
    <SectionShell id="missao" className="border-t border-border/60">
      <SectionHeading
        index="04"
        eyebrow="missões, não tarefas"
        title={
          <>
            O VETOR trabalha sozinho no que foi autorizado —{" "}
            <span className="text-amber">e para onde a decisão é sua.</span>
          </>
        }
        subtitle="Uma missão de crescimento começa com uma intenção e termina com aprendizado registrado. Você acompanha cada passo em tempo real."
      />

      <div ref={ref} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <Reveal className="panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <MonoLabel tone="cyan">mission // delivery growth 04</MonoLabel>
            <span className="mono-label flex items-center gap-2 text-foreground">
              <StatusDot /> status · executing
            </span>
          </div>
          <ol className="mt-5 space-y-4">
            {EVENTOS.map((e, i) => (
              <li
                key={e.hora}
                className={`flex gap-4 transition-all duration-500 ${
                  visiveis > i ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <span className="font-mono text-[0.7rem] tracking-widest text-muted-foreground">
                  {e.hora}
                </span>
                <span className="relative flex flex-1 gap-3">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      e.tone === "amber" ? "bg-amber" : "bg-primary"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-foreground">{e.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={140}>
          <div className="rounded-2xl border border-amber/40 bg-amber/[0.06] p-5 shadow-panel sm:p-6">
            <MonoLabel tone="amber">your decision is required</MonoLabel>
            <p className="mt-3 text-xl leading-snug font-semibold">Aprovar o lançamento da campanha?</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <dt className="text-muted-foreground">Teto de investimento</dt>
                <dd className="font-mono text-foreground">R$ 1.500</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <dt className="text-muted-foreground">Duração</dt>
                <dd className="font-mono text-foreground">14 dias</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Trava automática</dt>
                <dd className="font-mono text-primary">ATIVA</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => toast("Missão aberta em modo demonstração.")}
                className="hover-pop h-11 flex-1 rounded-xl border border-border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                REVISAR MISSÃO
              </button>
              <button
                type="button"
                onClick={() => {
                  setAprovado(true);
                  toast.success("Campanha aprovada — o VETOR assume daqui.");
                }}
                className="hover-pop h-11 flex-1 rounded-xl bg-amber text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {aprovado ? "APROVADO ✓" : "APROVAR"}
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Você mantém o controle. VETOR coordena o trabalho.
            </p>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
