"use client";

import { useState } from "react";
import Link from "next/link";
import { readApiResponse } from "@/lib/api/readApiResponse";

export type RiscoEtapa = "low" | "medium" | "high" | "critical";

interface EtapaIntent {
  chave: string;
  agente: string;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
  // Calculado no backend (policyEngine + gateway de ferramentas) — nunca no
  // navegador. Opcional só por compatibilidade com respostas antigas em cache;
  // na prática o backend sempre preenche.
  risco?: RiscoEtapa;
  requerAprovacao?: boolean;
}

export type CategoriaMissao = "strategy" | "content" | "traffic" | "design" | "analytics" | "support";
export type ConfiancaMissao = "high" | "medium" | "low";

export interface MissaoProposta {
  titulo: string;
  objetivo: string;
  hipotese?: string;
  criterioSucesso: string[];
  perguntas: string[];
  etapas: EtapaIntent[];
  category?: CategoriaMissao;
  confidence?: ConfiancaMissao;
}

const LABEL_CATEGORIA: Record<CategoriaMissao, string> = {
  strategy: "estratégia",
  content: "conteúdo",
  traffic: "tráfego",
  design: "design",
  analytics: "análise",
  support: "suporte",
};

const LABEL_CONFIANCA: Record<ConfiancaMissao, string> = {
  high: "alta confiança",
  medium: "confiança média",
  low: "baixa confiança",
};

// Risco por etapa vem sempre calculado pelo backend (policyEngine + gateway de
// ferramentas em apps/agentes) — o painel só exibe, nunca reclassifica aqui
// (antes desta rodada havia uma cópia local desse mapa, que podia divergir do
// backend; removida em favor da fonte única).
const BADGE_RISCO: Record<RiscoEtapa, string> = {
  low: "border-menta/30 bg-menta/10 text-menta",
  medium: "border-ambar/40 bg-ambar/10 text-ambar",
  high: "border-coral/40 bg-coral/10 text-coral",
  critical: "border-coral/60 bg-coral/20 text-coral",
};

const LABEL_RISCO: Record<RiscoEtapa, string> = {
  low: "baixo risco",
  medium: "precisa aprovação",
  high: "alto risco",
  critical: "crítico — nunca automático",
};

export default function VetorIntentCard({
  intent,
  solicitacaoId,
}: {
  intent: MissaoProposta;
  // Id da solicitação que gerou esta proposta (Fase 3/5) — enviado de volta na
  // confirmação pra o backend linkar a missão criada e garantir que confirmar
  // duas vezes nunca crie duas missões. Opcional só por segurança de tipo;
  // respostas atuais do Vetor sempre incluem.
  solicitacaoId?: string;
}) {
  const [status, setStatus] = useState<"pendente" | "enviando" | "confirmada" | "erro">("pendente");
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarMissao() {
    setStatus("enviando");
    setErro(null);
    try {
      const res = await fetch("/api/missoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: intent, solicitacao_id: solicitacaoId }),
      });
      await readApiResponse(res);
      setStatus("confirmada");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui confirmar a missão agora.");
      setStatus("erro");
    }
  }

  return (
    <div className="mt-2 max-w-[92%] rounded-2xl border border-ambar/30 bg-petroleo-2/80 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ambar">Proposta de missão</p>
        {intent.category && (
          <span className="rounded-full border border-areia/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-areia/50">
            {LABEL_CATEGORIA[intent.category]}
          </span>
        )}
        {intent.confidence && (
          <span className="rounded-full border border-areia/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-areia/50">
            {LABEL_CONFIANCA[intent.confidence]}
          </span>
        )}
      </div>
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
          // Falha fechado: se por algum motivo o backend não mandou risco
          // (resposta antiga em cache), trata como crítico em vez de assumir
          // baixo risco silenciosamente — mesma postura de tools/registry.ts.
          const risco = etapa.risco ?? "critical";
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
