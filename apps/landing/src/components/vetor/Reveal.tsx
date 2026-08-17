"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "./hooks";

export function Reveal({
  children,
  delay = 0,
  as = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "li" | "section" | "span";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [intersected, setIntersected] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const visible = reducedMotion || intersected;

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIntersected(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const props = {
    "data-visible": visible ? "true" : "false",
    style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    className: `reveal ${className}`,
    children,
  };

  switch (as) {
    case "li":
      return <li ref={ref as React.Ref<HTMLLIElement>} {...props} />;
    case "section":
      return <section ref={ref as React.Ref<HTMLElement>} {...props} />;
    case "span":
      return <span ref={ref as React.Ref<HTMLSpanElement>} {...props} />;
    default:
      return <div ref={ref as React.Ref<HTMLDivElement>} {...props} />;
  }
}
