"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CoreState } from "./VetorCore";
import { MonoLabel, StatusDot } from "./system";

const STAGES: { state: CoreState; label: string }[] = [
  { state: "listening", label: "LISTENING" },
  { state: "understanding", label: "UNDERSTANDING OBJECTIVE" },
  { state: "planning", label: "MAPPING OPPORTUNITIES" },
  { state: "executing", label: "ASSEMBLING SPECIALISTS" },
  { state: "success", label: "MISSION READY" },
];

export const SUGESTOES = [
  "Quero aumentar meus pedidos de delivery nas próximas quatro semanas.",
  "Preciso preencher os horários vazios da minha agenda.",
  "Quero mais orçamentos qualificados na minha região.",
];

export function CommandBar({
  onStateChange,
}: {
  onStateChange?: (s: CoreState) => void;
}) {
  const [valor, setValor] = useState("");
  const [stage, setStage] = useState(-1);
  const [objetivo, setObjetivo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!onStateChange) return;
    onStateChange(stage < 0 ? "idle" : STAGES[Math.min(stage, STAGES.length - 1)]!.state);
  }, [stage, onStateChange]);

  function run(e: FormEvent) {
    e.preventDefault();
    const texto = valor.trim();
    if (!texto) {
      inputRef.current?.focus();
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setObjetivo(texto);
    setStage(0);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = reduced ? 120 : 750;
    STAGES.forEach((_, i) => {
      if (i === 0) return;
      timers.current.push(window.setTimeout(() => setStage(i), i * step));
    });
  }

  const rodando = stage >= 0 && stage < STAGES.length - 1;
  const pronto = stage === STAGES.length - 1;

  return (
    <div className="w-full">
      <form onSubmit={run} className="panel flex items-center gap-2 rounded-2xl p-2 pl-4">
        <StatusDot />
        <label htmlFor="vetor-command" className="sr-only">
          Diga ao VETOR o que você quer alcançar
        </label>
        <input
          id="vetor-command"
          ref={inputRef}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Diga ao VETOR o que você quer alcançar…"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
        />
        <button
          type="submit"
          aria-label="Enviar objetivo para o VETOR"
          className="hover-pop inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              d="M4 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setValor(s);
              inputRef.current?.focus();
            }}
            className="hover-pop rounded-full border border-border bg-surface-2/50 px-3 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {s}
          </button>
        ))}
      </div>

      {stage >= 0 ? (
        <div className="panel mt-4 rounded-2xl p-4 sm:p-5" aria-live="polite">
          <ol className="space-y-1.5">
            {STAGES.map((s, i) => {
              const done = stage > i;
              const atual = stage === i;
              return (
                <li
                  key={s.label}
                  className={`flex items-center gap-3 font-mono text-[0.7rem] tracking-[0.14em] transition-opacity duration-300 ${
                    stage >= i ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      done ? "bg-primary" : atual ? "bg-amber animate-blink" : "bg-border"
                    }`}
                    aria-hidden="true"
                  />
                  <span className={done ? "text-primary" : atual ? "text-foreground" : "text-muted-foreground"}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {pronto ? (
            <div className="animate-pop-in mt-5 rounded-xl border border-amber/35 bg-amber/5 p-4">
              <MonoLabel tone="amber">mission created</MonoLabel>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                <span className="text-muted-foreground">Objetivo: </span>
                {objetivo}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-mono text-[0.7rem] tracking-widest text-primary">AGENTS</span>{" "}
                Estrategista / Copywriter / Design / Gestor de Tráfego
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-mono text-[0.7rem] tracking-widest text-primary">NEXT</span>{" "}
                Definir o orçamento da campanha
              </p>
            </div>
          ) : null}
          {rodando ? (
            <p className="mt-4 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground">
              PROCESSANDO SINAIS…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
