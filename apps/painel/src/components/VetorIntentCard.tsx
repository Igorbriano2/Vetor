"use client";

import { useState } from "react";
import Link from "next/link";

interface EtapaIntent {
  chave: string;
  agente: string;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
}

export interface MissaoProposta {
  titulo: string;
  objetivo: string;
  hipotese?: string;
  criterioSucesso: string[];
  perguntas: string[];
  etapas: EtapaIntent[];
}

const RISCO_POR_FERRAMENTA: Record<string, "low" | "medium" | "high"> = {
  ajustar_orcamento_trafego: "high",
  pausar_campanha_trafego: "medium",
  publicar_conteudo_social: "medium",
  agendar_conteudo_social: "low",
  gerar_copy: "low",
  gerar_design: "low",
  gerar_relatorio: "low",
};

function riscoDaEtapa(ferramentas: string[]): "low" | "medium" | "high" {
  const ordem = ["low", "medium", "high"] as const;
  let maior: "low" | "medium" | "high" = "low";
  for (const f of ferramentas) {
    const r = RISCO_POR_FERRAMENTA[f] ?? "high";
    if (ordem.indexOf(r) > ordem.indexOf(maior)) maior = r;
  }
  return maior;
}

const BADGE_RISCO: Record<"low" | "medium" | "high", string> = {
  low: "border-menta/30 bg-menta/10 text-menta",
  medium: "border-ambar/40 bg-ambar/10 text-ambar",
  high: "border-coral/40 bg-coral/10 text-coral",
};

const LABEL_RISCO: Record<"low" | "medium" | "high", string> = {
  low: "baixo risco",
  medium: "precisa aprovação",
  high: "alto risco",
};

export default function VetorIntentCard({ intent }: { intent: MissaoProposta }) {
  const [status, setStatus] = useState<"pendente" | "enviando" | "confirmada" | "erro">("pendente");
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarMissao() {
    setStatus("enviando");
    setErro(null);
    try {
      const res = await fetch("/api/missoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: intent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao confirmar missão");
      setStatus("confirmada");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui confirmar a missão agora.");
      setStatus("erro");
    }
  }

  return (
    <div className="mt-2 max-w-[92%] rounded-2xl border border-ambar/30 bg-petroleo-2/80 p-4 backdrop-blur">
      <p className="font-mono text-[11px] uppercase tracking-wide text-ambar">Proposta de missão</p>
      <h3 className="mt-1 text-base font-semibold text-areia">{intent.titulo}</h3>
      <p className="mt-1 text-sm text-areia/70">{intent.objetivo}</p>

      {intent.hipotese && (
        <p className="mt-2 text-xs text-areia/50">
          <span className="text-areia/70">Hipótese:</span> {intent.hipotese}
        </p>
      )}

      {intent.perguntas.length > 0 && (
        <div className="mt-3 rounded-xl border border-areia/10 bg-petroleo/60 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">Antes de confirmar</p>
          <ul className="mt-1 space-y-1 text-xs text-areia/70">
            {intent.perguntas.map((p, i) => (
              <li key={i}>• {p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {intent.etapas.map((etapa) => {
          const risco = riscoDaEtapa(etapa.ferramentas);
          return (
            <div key={etapa.chave} className="flex items-start justify-between gap-3 rounded-xl border border-areia/10 bg-petroleo/50 p-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-areia/50">{etapa.agente}</p>
                <p className="mt-0.5 text-sm text-areia">{etapa.tarefa}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${BADGE_RISCO[risco]}`}>
                {LABEL_RISCO[risco]}
              </span>
            </div>
          );
        })}
      </div>

      {status === "confirmada" ? (
        <p className="mt-4 text-sm font-medium text-menta">
          Missão confirmada — acompanhe o andamento em <Link href="/missoes" className="underline underline-offset-2">Missões</Link>.
        </p>
      ) : (
        <button
          onClick={confirmarMissao}
          disabled={status === "enviando"}
          className="mt-4 w-full rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
        >
          {status === "enviando" ? "Confirmando..." : "Confirmar missão"}
        </button>
      )}

      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
    </div>
  );
}
