"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  MOBILE_SPECIALISTS,
  OPERATION_STEPS,
  SPECIALISTS,
  STEP_META,
  type VetorOperationState,
  type VetorOperationStep,
} from "./types";

type Props = {
  state: VetorOperationState;
  step: VetorOperationStep;
  origin: { x: number; y: number };
  prefersReducedMotion: boolean;
  onSkip: () => void;
  onClose: () => void;
};

function CoreVisual({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none relative aspect-square w-[72vw] max-w-[34rem] sm:w-[60vw] lg:w-[46vw]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="animate-ring-out absolute inset-[26%] rounded-full border"
          style={{
            borderColor: "color-mix(in oklab, var(--op-ink) 26%, transparent)",
            animationDelay: `${i * 0.8}s`,
          }}
          aria-hidden="true"
        />
      ))}
      <svg viewBox="0 0 400 400" className="relative size-full" aria-hidden="true">
        <defs>
          <radialGradient id="op-core-grad">
            <stop offset="0%" stopColor="var(--op-warm-white)" stopOpacity="0.98" />
            <stop offset="48%" stopColor="var(--op-yellow-lum)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--op-amber-deep)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g stroke="var(--op-ink)" strokeOpacity="0.14" fill="none">
          <circle cx="200" cy="200" r="196" />
          <circle cx="200" cy="200" r="158" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <line
                key={i}
                x1={200 + Math.cos(a) * 100}
                y1={200 + Math.sin(a) * 100}
                x2={200 + Math.cos(a) * 196}
                y2={200 + Math.sin(a) * 196}
              />
            );
          })}
        </g>
        <g style={{ transformOrigin: "200px 200px" }} className="animate-spin-slow">
          <ellipse
            cx="200"
            cy="200"
            rx="176"
            ry="66"
            fill="none"
            stroke="var(--op-ink)"
            strokeOpacity="0.34"
            strokeDasharray="3 11"
          />
          <circle cx="376" cy="200" r="5" fill="var(--op-ink)" />
        </g>
        <g
          style={{ transformOrigin: "200px 200px", transform: "rotate(-38deg)" }}
          className="animate-spin-slower"
        >
          <circle
            cx="200"
            cy="200"
            r="130"
            fill="none"
            stroke="var(--op-warm-white)"
            strokeOpacity="0.6"
          />
          <circle cx="330" cy="200" r="4" fill="var(--op-warm-white)" />
        </g>
        <g
          fill="none"
          stroke="var(--op-ink)"
          strokeOpacity={active ? 0.5 : 0.24}
          strokeDasharray="16 220"
          className="animate-dash"
        >
          <circle cx="200" cy="200" r="100" />
          <circle cx="200" cy="200" r="140" />
        </g>
        <circle cx="200" cy="200" r="90" fill="url(#op-core-grad)" className="animate-breathe" />
        <circle cx="200" cy="200" r="46" fill="none" stroke="var(--op-ink)" strokeOpacity="0.45" />
        <path
          d="M176 178l24 46 24-46"
          fill="none"
          stroke="var(--op-ink)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function SpecialistNodes({ litCount }: { litCount: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {SPECIALISTS.map((name, i) => {
        const angle = (i / SPECIALISTS.length) * Math.PI * 2 - Math.PI / 2;
        const left = 50 + Math.cos(angle) * 41;
        const top = 50 + Math.sin(angle) * 41;
        const lit = i < litCount;
        const mobileHidden = !MOBILE_SPECIALISTS.includes(name);
        return (
          <span
            key={name}
            className={`animate-node-in absolute ${mobileHidden ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.55rem] tracking-[0.18em] whitespace-nowrap sm:text-[0.6rem] ${
              lit
                ? "border-[var(--op-ink)]/60 bg-[var(--op-ink)] text-[var(--op-warm-white)]"
                : "border-[var(--op-ink)]/25 bg-[var(--op-warm-white)]/35 text-[var(--op-ink)]/60"
            }`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: "translate(-50%, -50%)",
              animationDelay: `${i * 120}ms`,
            }}
          >
            <span
              className={`size-1.5 rounded-full ${lit ? "bg-[var(--op-yellow)]" : "bg-[var(--op-ink)]/30"}`}
            />
            {name}
          </span>
        );
      })}
    </div>
  );
}

function Result({ onClose }: { onClose: () => void }) {
  return (
    <div className="animate-pop-in mx-auto w-full max-w-2xl text-center">
      <p className="font-mono text-[0.62rem] tracking-[0.3em] text-[var(--op-ink)]/70">
        DIAGNÓSTICO PRONTO
      </p>
      <h2 className="mt-3 text-2xl leading-tight font-semibold text-[var(--op-ink)] sm:text-3xl">
        O VETOR identificou uma oportunidade de crescimento com base nos sinais disponíveis.
      </h2>
      <p className="mt-5 font-mono text-[0.58rem] tracking-[0.24em] text-[var(--op-ink)]/60">
        PRÓXIMA MISSÃO RECOMENDADA
      </p>
      <p className="mt-2 text-base text-[var(--op-ink)]/85">
        Construir uma campanha orientada ao objetivo informado.
      </p>
      <p className="mt-5 text-xs leading-relaxed text-[var(--op-ink)]/60">
        Demonstração conceitual baseada no objetivo informado.
        <br />
        Um diagnóstico real utiliza os dados do seu negócio.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href="#ativar"
          onClick={onClose}
          className="hover-pop inline-flex h-12 items-center justify-center rounded-xl bg-[var(--op-ink)] px-6 font-mono text-xs tracking-[0.18em] text-[var(--op-warm-white)]"
        >
          ENTRAR NO VETOR
        </a>
        <button
          type="button"
          onClick={onClose}
          className="hover-pop inline-flex h-12 items-center justify-center rounded-xl border border-[var(--op-ink)]/40 px-6 font-mono text-xs tracking-[0.18em] text-[var(--op-ink)]"
        >
          VOLTAR À LANDING PAGE
        </button>
      </div>
    </div>
  );
}

export function VetorOperationOverlay({
  state,
  step,
  origin,
  prefersReducedMotion,
  onSkip,
  onClose,
}: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !layerRef.current) return;
      const nodes = layerRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const closing = state === "closing";
  const stepIndex = OPERATION_STEPS.indexOf(step);
  const meta = STEP_META[step];
  const done = state === "diagnostic_ready";
  const litCount = done ? SPECIALISTS.length : Math.max(0, Math.min(SPECIALISTS.length, stepIndex * 2));

  return (
    <div
      ref={layerRef}
      role="dialog"
      aria-modal="true"
      aria-label="VETOR em modo de operação — diagnóstico demonstrativo"
      className="vetor-operation-overlay"
      style={{ "--op-x": `${origin.x}%`, "--op-y": `${origin.y}%` } as CSSProperties}
    >
      <div
        className={`op-scene-bg absolute inset-0 ${
          prefersReducedMotion
            ? ""
            : closing
              ? "animate-field-collapse"
              : state === "expanding"
                ? "animate-field-expand"
                : ""
        }`}
        aria-hidden="true"
      />
      <div className="op-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 200px 60px color-mix(in oklab, var(--op-amber-deep) 55%, transparent)" }}
        aria-hidden="true"
      />

      <div className="relative flex h-full w-full flex-col overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.6rem] tracking-[0.28em] text-[var(--op-ink)] sm:text-[0.68rem]">
              VETOR // OPERATION MODE
            </p>
            <p className="mt-1 font-mono text-[0.58rem] tracking-[0.28em] text-[var(--op-ink)]/60">
              SYSTEM ACTIVE
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!done ? (
              <button
                ref={firstFocusRef}
                type="button"
                onClick={onSkip}
                className="hover-pop rounded-lg border border-[var(--op-ink)]/30 px-3 py-1.5 font-mono text-[0.58rem] tracking-[0.18em] text-[var(--op-ink)]/80"
              >
                PULAR DEMONSTRAÇÃO
              </button>
            ) : null}
            <button
              ref={done ? firstFocusRef : undefined}
              type="button"
              onClick={onClose}
              aria-label="Fechar modo de operação"
              className="hover-pop grid size-9 place-items-center rounded-lg border border-[var(--op-ink)]/30 text-[var(--op-ink)]"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center py-6 lg:flex-row lg:items-center lg:justify-center">
          <div className="relative flex w-full flex-1 items-center justify-center">
            <div
              className={`relative flex aspect-square w-full max-w-[46rem] items-center justify-center ${done ? "max-h-[34vh] sm:max-h-none" : ""}`}
            >
              <CoreVisual active={state !== "activating"} />
              <SpecialistNodes litCount={litCount} />
            </div>
          </div>

          <ol
            className="mt-4 w-full shrink-0 space-y-1.5 lg:mt-0 lg:w-64"
            aria-label="Timeline da operação"
          >
            {OPERATION_STEPS.slice(1).map((s, i) => {
              const active = OPERATION_STEPS.indexOf(s) <= stepIndex || done;
              return (
                <li
                  key={s}
                  className={`flex items-center gap-2 font-mono text-[0.56rem] tracking-[0.16em] sm:text-[0.62rem] ${
                    active ? "text-[var(--op-ink)]" : "text-[var(--op-ink)]/40"
                  }`}
                >
                  <span className="opacity-70">{STEP_META[s].index}</span>
                  <span
                    className={`h-px flex-none transition-all ${active ? "w-5 bg-[var(--op-ink)]" : "w-3 bg-[var(--op-ink)]/30"}`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                  <span>{STEP_META[s].timeline}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div aria-live="polite" className="relative pb-4 text-center">
          {done ? (
            <Result onClose={onClose} />
          ) : (
            <>
              <p
                key={step}
                className="animate-status-in font-mono text-lg font-semibold tracking-[0.22em] text-[var(--op-ink)] sm:text-2xl"
              >
                {meta.status}
              </p>
              <p className="mt-2 font-mono text-[0.58rem] tracking-[0.28em] text-[var(--op-ink)]/55">
                {meta.statusEn}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
