import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

export function SectionShell({
  id,
  children,
  className = "",
  label,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={`relative px-5 py-20 sm:px-8 md:py-28 ${className}`}
    >
      <div className="relative mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function MonoLabel({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: "muted" | "cyan" | "amber";
  className?: string;
}) {
  const color =
    tone === "cyan" ? "text-primary" : tone === "amber" ? "text-amber" : "text-muted-foreground";
  return <span className={`mono-label ${color} ${className}`}>{children}</span>;
}

export function SectionHeading({
  index,
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={`mb-12 ${align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      {eyebrow ? (
        <Reveal>
          <div
            className={`flex items-center gap-3 ${align === "center" ? "justify-center" : ""}`}
          >
            <span className="h-px w-8 bg-primary/50" aria-hidden="true" />
            <MonoLabel tone="cyan">
              {index ? `${index} // ` : ""}
              {eyebrow}
            </MonoLabel>
          </div>
        </Reveal>
      ) : null}
      <Reveal delay={80}>
        <h2 className="mt-4 text-[1.75rem] leading-[1.12] font-semibold text-balance sm:text-4xl md:text-[2.6rem]">
          {title}
        </h2>
      </Reveal>
      {subtitle ? (
        <Reveal delay={150}>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {subtitle}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}

export function StatusDot({ tone = "cyan" }: { tone?: "cyan" | "amber" | "alert" }) {
  const bg = tone === "amber" ? "bg-amber" : tone === "alert" ? "bg-alert" : "bg-primary";
  return (
    <span className="relative inline-flex size-2 items-center justify-center" aria-hidden="true">
      <span className={`absolute inline-flex size-2 rounded-full ${bg} opacity-60 animate-breathe`} />
      <span className={`relative inline-flex size-1.5 rounded-full ${bg}`} />
    </span>
  );
}

export function VetorMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid size-9 place-items-center rounded-lg border border-primary/35 bg-primary/10">
        <svg viewBox="0 0 24 24" className="size-4 text-primary" aria-hidden="true">
          <path
            d="M4 6l6.5 11L21 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[0.95rem] font-semibold tracking-[0.22em]">VETOR</span>
        <span className="mono-label block text-[0.55rem] tracking-[0.2em]">
          growth intelligence system
        </span>
      </span>
    </span>
  );
}

export function CtaPrimary({
  children,
  href,
  onClick,
  type = "button",
  className = "",
  disabled,
  target,
  rel,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
  target?: string;
  rel?: string;
}) {
  const cls = `hover-pop inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold tracking-wide text-primary-foreground shadow-glow hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${className}`;
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function CtaGhost({
  children,
  href,
  onClick,
  className = "",
  target,
  rel,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  target?: string;
  rel?: string;
}) {
  const cls = `hover-pop inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 px-6 text-sm font-semibold tracking-wide text-foreground hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`;
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
