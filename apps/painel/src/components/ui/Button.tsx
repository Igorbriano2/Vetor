import type { ComponentPropsWithoutRef } from "react";

// Redesign Apple-style (fase 3) — primitivo real de botão, mesmo raciocínio
// do Card.tsx: telas existentes continuam com a classe CSS crua (funciona
// igual), este componente é pra escrita nova. `variant` cobre os 4 padrões
// que já existiam espalhados como Tailwind cru pelo painel — nunca inventa
// uma variante nova sem um caso de uso real primeiro.
//
// Só <button> de propósito (nunca <a>/Link) — pra um link estilizado como
// botão, o padrão já usado em todo o painel é `<Link className="rounded-full
// ...">` direto; misturar as duas semânticas num componente só (onClick vs
// navegação) tende a confundir mais do que ajudar.
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTE: Record<Variant, string> = {
  primary: "btn-tactile font-semibold bg-ambar text-petroleo hover:bg-ambar-forte disabled:opacity-50",
  secondary: "border border-areia/15 text-areia/80 hover:border-menta/40 hover:text-menta disabled:opacity-50",
  ghost: "text-areia/60 hover:text-areia disabled:opacity-40",
  danger: "border border-coral/40 font-medium text-coral hover:bg-coral/10 disabled:opacity-50",
};

const TAMANHO: Record<Size, string> = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
};

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
  size?: Size;
}

export default function Button({ variant = "primary", size = "md", className = "", type = "button", children, ...rest }: ButtonProps) {
  const classes = `rounded-full transition ${VARIANTE[variant]} ${TAMANHO[size]} ${className}`.replace(/\s+/g, " ").trim();
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
