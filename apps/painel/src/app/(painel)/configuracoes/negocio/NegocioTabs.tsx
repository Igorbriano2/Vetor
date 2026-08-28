import Link from "next/link";

const ABAS = [
  { id: "negocio", label: "Negócio", href: "/configuracoes/negocio" },
  { id: "conexoes", label: "Conexões", href: "/configuracoes/negocio?aba=conexoes" },
  { id: "drive", label: "Drive", href: "/configuracoes/negocio/banco-de-imagens" },
] as const;

// Achado ao vivo: o cliente relatou não conseguir achar o Drive (Banco de
// imagens) de jeito nenhum — a única entrada existente era um link
// enterrado dentro de nodes do Creative Canvas. As 3 abas de Negócio
// (perfil/brand kit, conexões oficiais, Drive de ativos) são conceitos
// irmãos — mesmo nível — mas viviam em 2 padrões de navegação diferentes
// (query string na mesma página vs. rota própria). Este componente é a
// MESMA barra nas 2 telas, pra nunca parecerem áreas desconectadas.
export default function NegocioTabs({ ativa }: { ativa: "negocio" | "conexoes" | "drive" }) {
  return (
    <div className="mb-6 flex gap-2 border-b border-areia/10">
      {ABAS.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${
            ativa === a.id ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"
          }`}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}
