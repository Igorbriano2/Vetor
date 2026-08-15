"use client";

import { useState } from "react";

interface MissionStep {
  id: string;
  agente: string;
  tarefa: string;
  status: string;
  risco: string;
  resultado: { summary?: string } | null;
}

interface Approval {
  id: string;
  mission_step_id: string | null;
  acao: string;
  risco: string;
  status: string;
}

const LABEL_AGENTE: Record<string, string> = {
  design: "Design",
  trafego: "Tráfego",
  estrategia: "Estratégia",
  growth: "Growth",
  "social-media": "Social Media",
  video: "Vídeo",
  analitico: "Analítico",
};

function frasePorEtapa(etapa: MissionStep): string {
  const agente = LABEL_AGENTE[etapa.agente] ?? etapa.agente;
  switch (etapa.status) {
    case "pending":
      return `${agente} aguarda a conclusão de uma etapa anterior.`;
    case "ready":
      return `${agente} está na fila para começar.`;
    case "running":
      return `${agente} está trabalhando em: ${etapa.tarefa}`;
    case "awaiting_approval":
      return `${agente} está aguardando sua aprovação para: ${etapa.tarefa}`;
    case "completed":
      return `${agente} concluiu: ${etapa.resultado?.summary ?? etapa.tarefa}`;
    case "failed":
      return `${agente} não conseguiu concluir esta etapa: ${etapa.resultado?.summary ?? etapa.tarefa}`;
    case "blocked":
      return `${agente} está bloqueado nesta etapa.`;
    case "cancelled":
      return `Etapa de ${agente} foi cancelada.`;
    case "skipped":
      return `Etapa de ${agente} foi pulada.`;
    default:
      return `${agente}: ${etapa.tarefa}`;
  }
}

const COR_STATUS: Record<string, string> = {
  pending: "bg-areia/20",
  ready: "bg-areia/30",
  running: "bg-menta shadow-[0_0_8px_theme(colors.menta)]",
  awaiting_approval: "bg-ambar shadow-[0_0_8px_theme(colors.ambar)]",
  completed: "bg-menta",
  failed: "bg-coral shadow-[0_0_8px_theme(colors.coral)]",
  blocked: "bg-coral/60",
  cancelled: "bg-areia/20",
  skipped: "bg-areia/20",
};

export default function VetorMissionTimeline({
  missionId,
  etapas,
  approvals,
}: {
  missionId: string;
  etapas: MissionStep[];
  approvals: Approval[];
}) {
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [decididas, setDecididas] = useState<Set<string>>(new Set());

  async function decidir(approvalId: string, decisao: "aprovar" | "rejeitar") {
    setDecidindo(approvalId);
    try {
      const res = await fetch(`/api/missoes/${missionId}/aprovacoes/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao }),
      });
      if (!res.ok) throw new Error("Falha ao registrar decisão");
      setDecididas((atual) => new Set(atual).add(approvalId));
    } catch {
      // erro silencioso o suficiente pro botão voltar ao normal; o estado real
      // vem do banco na próxima vez que a página recarregar.
    } finally {
      setDecidindo(null);
    }
  }

  const aprovacaoPorEtapa = new Map(approvals.filter((a) => a.mission_step_id).map((a) => [a.mission_step_id as string, a]));

  return (
    <div className="space-y-3 border-l border-areia/10 pl-5">
      {etapas.map((etapa) => {
        const aprovacao = aprovacaoPorEtapa.get(etapa.id);
        const pendente = aprovacao?.status === "pending" && !decididas.has(aprovacao.id);

        return (
          <div key={etapa.id} className="relative rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
            <span
              className={`absolute top-5 -left-[25px] size-2 rounded-full ${COR_STATUS[etapa.status] ?? "bg-areia/20"}`}
            />
            <p className="text-sm text-areia">{frasePorEtapa(etapa)}</p>

            {pendente && aprovacao && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => decidir(aprovacao.id, "aprovar")}
                  disabled={decidindo === aprovacao.id}
                  className="rounded-full bg-menta px-4 py-1.5 text-xs font-semibold text-petroleo transition hover:bg-menta-forte disabled:opacity-50"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => decidir(aprovacao.id, "rejeitar")}
                  disabled={decidindo === aprovacao.id}
                  className="rounded-full border border-coral/40 px-4 py-1.5 text-xs font-semibold text-coral transition hover:bg-coral/10 disabled:opacity-50"
                >
                  Rejeitar
                </button>
              </div>
            )}
            {aprovacao && !pendente && aprovacao.status !== "pending" && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-areia/40">
                {aprovacao.status === "approved" ? "Aprovado" : aprovacao.status === "rejected" ? "Rejeitado" : aprovacao.status}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
