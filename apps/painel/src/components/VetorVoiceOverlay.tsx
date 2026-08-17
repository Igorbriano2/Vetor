"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import VetorCore, { type EstadoCore } from "./VetorCore";

// Modo amarelo de voz — camada fullscreen sobre o painel inteiro (não um
// modal, não um card inline) durante listening/speaking. Reaproveita
// VetorCore (mesmo SVG, cor já muda pra âmbar nesses estados) em vez de
// duplicar uma segunda identidade visual — só a atmosfera ao redor muda.
export default function VetorVoiceOverlay({
  ativo,
  estado,
  amplitude,
  transcricaoParcial,
  onParar,
}: {
  ativo: boolean;
  estado: EstadoCore;
  amplitude?: number;
  transcricaoParcial?: string;
  onParar: () => void;
}) {
  const [montado] = useState(() => typeof document !== "undefined");
  const [reduzMovimento, setReduzMovimento] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setReduzMovimento(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onParar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ativo, onParar]);

  if (!montado || !ativo) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vetor em modo de voz"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--color-ambar) 26%, var(--color-petroleo)), var(--color-petroleo) 78%)",
        transition: reduzMovimento ? "none" : "background 400ms ease",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 220px 70px color-mix(in oklab, var(--color-ambar) 35%, transparent)" }}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={onParar}
        aria-label="Parar e fechar modo de voz"
        className="absolute top-6 right-6 z-10 grid size-11 place-items-center rounded-full border border-ambar/40 bg-petroleo-2/70 text-ambar transition hover:border-ambar"
      >
        ✕
      </button>

      <VetorCore estado={estado} className="w-64 sm:w-80" amplitude={reduzMovimento ? undefined : amplitude} />

      <p className="mt-8 max-w-md px-6 text-center text-lg font-medium text-areia">
        {transcricaoParcial || (estado === "listening" ? "Estou ouvindo..." : estado === "speaking" ? "Respondendo..." : "")}
      </p>

      <button
        type="button"
        onClick={onParar}
        className="mt-8 rounded-full border border-ambar/40 px-6 py-2.5 text-sm font-semibold text-ambar transition hover:bg-ambar/10"
      >
        Parar
      </button>
    </div>,
    document.body,
  );
}
