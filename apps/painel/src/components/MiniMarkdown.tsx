import { Fragment } from "react";

// Renderizador de markdown mínimo, sem dependência nova — o conteúdo que
// os agentes entregam (planos, legendas, relatórios) só usa headers (#/##/###),
// negrito (**texto**) e listas (- item), nunca markdown completo (tabelas,
// links, código). Achado ao vivo: esse texto tava sendo jogado cru num
// <pre>, o "#"/"**" aparecia literal na tela pro cliente.
function renderizarInline(texto: string, keyBase: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-areia">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyBase}-${i}`}>{parte}</Fragment>;
  });
}

export default function MiniMarkdown({ texto, className = "" }: { texto: string; className?: string }) {
  const linhas = texto.split("\n");
  const blocos: Array<{ tipo: "h1" | "h2" | "h3" | "li" | "p" | "vazio"; texto: string }> = linhas.map((linha) => {
    if (/^###\s+/.test(linha)) return { tipo: "h3", texto: linha.replace(/^###\s+/, "") };
    if (/^##\s+/.test(linha)) return { tipo: "h2", texto: linha.replace(/^##\s+/, "") };
    if (/^#\s+/.test(linha)) return { tipo: "h1", texto: linha.replace(/^#\s+/, "") };
    if (/^[-*]\s+/.test(linha)) return { tipo: "li", texto: linha.replace(/^[-*]\s+/, "") };
    if (linha.trim() === "") return { tipo: "vazio", texto: "" };
    return { tipo: "p", texto: linha };
  });

  const elementos: React.ReactNode[] = [];
  let listaAtual: string[] = [];
  const fecharLista = (key: string) => {
    if (listaAtual.length === 0) return;
    elementos.push(
      <ul key={key} className="my-1.5 list-disc space-y-0.5 pl-5">
        {listaAtual.map((item, i) => (
          <li key={i}>{renderizarInline(item, `${key}-li-${i}`)}</li>
        ))}
      </ul>,
    );
    listaAtual = [];
  };

  blocos.forEach((bloco, i) => {
    if (bloco.tipo === "li") {
      listaAtual.push(bloco.texto);
      return;
    }
    fecharLista(`ul-${i}`);
    if (bloco.tipo === "h1") elementos.push(<p key={i} className="mt-3 mb-1 text-sm font-bold text-areia first:mt-0">{renderizarInline(bloco.texto, `h1-${i}`)}</p>);
    else if (bloco.tipo === "h2") elementos.push(<p key={i} className="mt-3 mb-1 text-sm font-semibold text-areia first:mt-0">{renderizarInline(bloco.texto, `h2-${i}`)}</p>);
    else if (bloco.tipo === "h3") elementos.push(<p key={i} className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-areia/70">{renderizarInline(bloco.texto, `h3-${i}`)}</p>);
    else if (bloco.tipo === "p") elementos.push(<p key={i}>{renderizarInline(bloco.texto, `p-${i}`)}</p>);
    // "vazio" só fecha parágrafo/lista, não gera elemento — espaçamento já vem do space-y do container.
  });
  fecharLista("ul-fim");

  return <div className={`space-y-1 ${className}`}>{elementos}</div>;
}
