"use client";

import { useState } from "react";
import Link from "next/link";
import { readApiResponse } from "@/lib/api/readApiResponse";

interface CalendarioItem {
  data: string;
  titulo: string;
  canal?: string;
  tipo?: string;
}

interface EtapaPlano {
  chave: string;
  agente: string;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
}

interface RespostaMissao {
  missionId: string;
  idempotente: boolean;
}

// Geração em lote (Fase 5 do upgrade Gravyx) — a partir do calendário editorial
// já confirmado num artefato de planejamento, monta uma etapa de design ou
// vídeo (conforme o `tipo` da peça — ver ehConteudoDeVideo) + uma etapa de
// copy por peça (a de copy depende da etapa visual da mesma peça, pra manter
// coerência entre briefing e legenda) e reutiliza o mesmo caminho de criação
// de missão já usado pelo VetorIntentCard — nunca inventa um caminho de
// criação paralelo. Só usa ferramentas de baixo risco (criar_briefing/
// gerar_design/criar_copy): gera os briefings/rascunhos de todas as peças de
// uma vez sem gerar custo real nem exigir N aprovações — a geração da
// imagem/vídeo final de cada peça (Fase 6) continua um passo manual separado
// no Design/Videomaker, como em qualquer outra missão.
function ehConteudoDeVideo(tipo?: string): boolean {
  if (!tipo) return false;
  const t = tipo.toLowerCase();
  return t.includes("video") || t.includes("vídeo") || t.includes("reels") || t.includes("reel");
}
export default function GerarPecasCampanha({
  tituloPlano,
  periodo,
  calendario,
}: {
  tituloPlano: string;
  periodo?: string;
  calendario: CalendarioItem[];
}) {
  const [status, setStatus] = useState<"pendente" | "enviando" | "confirmada" | "erro">("pendente");
  const [erro, setErro] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);

  async function gerarPecas() {
    setStatus("enviando");
    setErro(null);

    const itens = [...calendario].sort((a, b) => a.data.localeCompare(b.data));
    const etapas: EtapaPlano[] = itens.flatMap((item, i) => {
      const chaveVisual = `visual-${i}`;
      const chaveCopy = `copy-${i}`;
      const canal = item.canal ?? "o canal indicado no calendário";
      const tipo = item.tipo ?? "post";
      const video = ehConteudoDeVideo(item.tipo);
      return [
        video
          ? {
              chave: chaveVisual,
              agente: "video",
              tarefa: `Crie o briefing/roteiro do vídeo "${item.titulo}" (${tipo}) para ${canal}, previsto para ${item.data}, dentro da campanha "${tituloPlano}". Use a identidade visual e o brand kit já cadastrados do cliente.`,
              dependeDe: [],
              ferramentas: ["criar_briefing"],
            }
          : {
              chave: chaveVisual,
              agente: "design",
              tarefa: `Crie o briefing e o rascunho de design da peça "${item.titulo}" (${tipo}) para ${canal}, prevista para ${item.data}, dentro da campanha "${tituloPlano}". Use a identidade visual e o brand kit já cadastrados do cliente.`,
              dependeDe: [],
              ferramentas: ["criar_briefing", "gerar_design"],
            },
        {
          chave: chaveCopy,
          agente: "social-media",
          tarefa: `Escreva a copy/legenda da peça "${item.titulo}" (${tipo}) para ${canal}, prevista para ${item.data}, alinhada ao briefing ${video ? "do roteiro" : "de design"} da mesma peça.`,
          dependeDe: [chaveVisual],
          ferramentas: ["criar_copy"],
        },
      ];
    });

    const plano = {
      titulo: `Peças da campanha — ${periodo ?? tituloPlano}`,
      objetivo: `Produzir o briefing de design e a copy de cada peça do calendário editorial "${tituloPlano}".`,
      criterioSucesso: [
        "Cada peça do calendário tem um briefing de design e uma copy gerados",
        "Nenhuma peça do calendário fica sem etapa correspondente",
      ],
      etapas,
    };

    try {
      const res = await fetch("/api/missoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const data = await readApiResponse<RespostaMissao>(res);
      setMissionId(data.missionId);
      setStatus("confirmada");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui gerar as peças agora.");
      setStatus("erro");
    }
  }

  if (calendario.length === 0) return null;

  if (status === "confirmada" && missionId) {
    return (
      <p className="mt-4 text-sm font-medium text-menta">
        Missão de geração criada —{" "}
        <Link href={`/missoes/${missionId}`} className="underline underline-offset-2">
          acompanhar o andamento
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        onClick={gerarPecas}
        disabled={status === "enviando"}
        className="rounded-full bg-ambar px-4 py-2 text-xs font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
      >
        {status === "enviando" ? "Gerando..." : `Gerar peças da campanha (${calendario.length})`}
      </button>
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
    </div>
  );
}
