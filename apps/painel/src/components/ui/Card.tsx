import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";

// Redesign Apple-style (fase 3) — primitivo real de "superfície elevada",
// pra parar de repetir `rounded-2xl panel p-4` cru em toda tela nova. As
// telas já existentes usam a classe CSS direto (funciona igual, migrar
// todas pra este componente não muda nada visualmente — não vale o
// churn); este componente é pra escrita NOVA daqui pra frente.
//
// `href` renderiza como Link (next/link) em vez de div — mesma classe
// visual, nunca duas implementações de "card" divergindo.
interface CardProps extends ComponentPropsWithoutRef<"div"> {
  href?: string;
  clickable?: boolean;
  radius?: "lg" | "xl" | "2xl";
}

const RADIUS: Record<NonNullable<CardProps["radius"]>, string> = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

export default function Card({ href, clickable = !!href, radius = "2xl", className = "", children, ...rest }: CardProps) {
  const classes = `${RADIUS[radius]} panel ${clickable ? "card-lift" : ""} ${className}`.replace(/\s+/g, " ").trim();

  if (href) {
    return (
      <Link href={href} className={classes} {...(rest as ComponentPropsWithoutRef<typeof Link>)}>
        {children}
      </Link>
    );
  }

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
