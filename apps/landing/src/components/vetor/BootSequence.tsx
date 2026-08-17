"use client";

import { useEffect, useRef, useState } from "react";

const LINES = [
  { label: "CONTEXT ENGINE", dots: "........", status: "ONLINE" },
  { label: "AGENT NETWORK", dots: ".........", status: "ONLINE" },
  { label: "GROWTH INTELLIGENCE", dots: "...", status: "ONLINE" },
  { label: "VETOR", dots: "..................", status: "READY" },
];

const STORAGE_KEY = "vetor-boot-seen";

export function BootSequence() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, "1");

    const scheduled = timers.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // A sequência de boot é um efeito único disparado na montagem (gate por sessionStorage),
    // não um estado derivado de props/state — não há como computar isso durante o render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(true);
    if (reduced) {
      setStep(LINES.length);
      scheduled.push(window.setTimeout(() => setActive(false), 300));
      return;
    }
    LINES.forEach((_, i) => {
      scheduled.push(window.setTimeout(() => setStep(i + 1), 200 + i * 260));
    });
    scheduled.push(window.setTimeout(() => setClosing(true), 1300));
    scheduled.push(window.setTimeout(() => setActive(false), 1750));
    return () => scheduled.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!active) return;
    const skip = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") setActive(false);
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [active]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setActive(false)}
      className={`fixed inset-0 z-[100] grid place-items-center bg-background px-6 transition-opacity duration-400 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative w-full max-w-md font-mono text-[0.7rem] tracking-[0.14em] sm:text-xs">
        <p className="mb-5 text-primary">VETOR SYSTEM // INITIALIZING</p>
        <ul className="space-y-2">
          {LINES.map((l, i) => (
            <li
              key={l.label}
              className={`flex items-center justify-between gap-2 transition-opacity duration-300 ${
                step > i ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className="text-muted-foreground">
                {l.label} <span className="text-border">{l.dots}</span>
              </span>
              <span className={l.status === "READY" ? "text-amber" : "text-primary"}>
                {l.status}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setActive(false)}
          className="mt-8 text-[0.65rem] tracking-[0.2em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          PULAR
        </button>
      </div>
    </div>
  );
}
