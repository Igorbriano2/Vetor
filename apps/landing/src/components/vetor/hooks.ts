"use client";

import { useSyncExternalStore } from "react";

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!mq) return () => {};
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function getReducedMotionServerSnapshot() {
  return false;
}

/** Lê `prefers-reduced-motion` sem derivar estado dentro de um efeito. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function subscribeNoop() {
  return () => {};
}

/** True somente após a hidratação no cliente — evita mismatch de SSR sem setState em efeito. */
export function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}
