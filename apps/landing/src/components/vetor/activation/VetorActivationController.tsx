"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useIsClient, usePrefersReducedMotion } from "../hooks";
import {
  OPERATION_STEPS,
  STEP_DURATION,
  type VetorOperationState,
  type VetorOperationStep,
} from "./types";
import { VetorOperationOverlay } from "./VetorOperationOverlay";

type Origin = { x: number; y: number };

type ActivationApi = {
  state: VetorOperationState;
  isActivationOpen: boolean;
  isStarting: boolean;
  activate: (origin?: Origin) => void;
};

const Ctx = createContext<ActivationApi | null>(null);

export function useVetorActivation() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVetorActivation precisa do VetorActivationController");
  return ctx;
}

export function VetorActivationController({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VetorOperationState>("closed");
  const [step, setStep] = useState<VetorOperationStep>("command_received");
  const [origin, setOrigin] = useState<Origin>({ x: 50, y: 45 });
  const mounted = useIsClient();
  const prefersReducedMotion = usePrefersReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastFocused = useRef<HTMLElement | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const isOperationOpen = state !== "closed";
  const isStarting = state === "activating" || state === "expanding";

  const runSteps = useCallback(() => {
    clearTimers();
    let acc = 0;
    for (const s of OPERATION_STEPS) {
      after(acc, () => {
        setStep(s);
        if (s === "result_ready") setState("diagnostic_ready");
      });
      const d = STEP_DURATION[s];
      if (d === 0) break;
      acc += prefersReducedMotion ? Math.min(d, 700) : d;
    }
  }, [after, clearTimers, prefersReducedMotion]);

  const activate = useCallback(
    (o?: Origin) => {
      if (isOperationOpen) return;
      lastFocused.current = (document.activeElement as HTMLElement) ?? null;
      if (o) setOrigin(o);
      clearTimers();
      setStep("command_received");
      setState("activating");
      if (prefersReducedMotion) {
        after(150, () => {
          setState("operating");
          runSteps();
        });
        return;
      }
      after(420, () => setState("expanding"));
      after(1280, () => {
        setState("operating");
        runSteps();
      });
    },
    [after, clearTimers, isOperationOpen, prefersReducedMotion, runSteps],
  );

  const close = useCallback(() => {
    clearTimers();
    setState("closing");
    after(prefersReducedMotion ? 120 : 460, () => {
      setState("closed");
      setStep("command_received");
      lastFocused.current?.focus?.();
    });
  }, [after, clearTimers, prefersReducedMotion]);

  const skip = useCallback(() => {
    clearTimers();
    setStep("result_ready");
    setState("diagnostic_ready");
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  // Bloqueio de scroll enquanto a camada estiver aberta
  useEffect(() => {
    if (!isOperationOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOperationOpen]);

  const value = useMemo(
    () => ({ state, isActivationOpen: isOperationOpen, isStarting, activate }),
    [state, isOperationOpen, isStarting, activate],
  );

  const showOverlay = state !== "closed" && state !== "activating";

  return (
    <Ctx.Provider value={value}>
      <div
        className={isOperationOpen ? "vetor-dimmed" : undefined}
        aria-hidden={isOperationOpen ? true : undefined}
      >
        {children}
      </div>
      {mounted && showOverlay
        ? createPortal(
            <VetorOperationOverlay
              state={state}
              step={step}
              origin={origin}
              prefersReducedMotion={prefersReducedMotion}
              onSkip={skip}
              onClose={close}
            />,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}
