"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { readApiResponse } from "@/lib/api/readApiResponse";

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

interface Artefato {
  id: string;
  missionStepId: string | null;
  type: string;
  title: string;
  status: string;
  content: string | null;
  url: string | null;
}

const LABEL_TIPO_ARTEFATO: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  copy: "Copy",
  document: "Documento",
  report: "Relatório",
  plan: "Plano",
  campaign_snapshot: "Campanha",
};

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
  etapas: etapasIniciais,
  approvals: approvalsIniciais,
  artefatos = [],
}: {
  missionId: string;
  etapas: MissionStep[];
  approvals: Approval[];
  artefatos?: Artefato[];
}) {
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [approvals, setApprovals] = useState(approvalsIniciais);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [decididas, setDecididas] = useState<Set<string>>(new Set());

  // Timeline viva: assina mudanças em mission_steps/approvals via Supabase Realtime
  // em vez de exigir refresh manual — o worker atualiza essas tabelas conforme processa a missão.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    function upsert<T extends { id: string }>(lista: T[], novo: T): T[] {
      const idx = lista.findIndex((item) => item.id === novo.id);
      if (idx === -1) return [...lista, novo];
      const copia = [...lista];
      copia[idx] = novo;
      return copia;
    }

    const channel = supabase
      .channel(`mission-timeline-${missionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_steps", filter: `mission_id=eq.${missionId}` },
        (payload) => {
          const novo = payload.new as MissionStep | undefined;
          if (novo) setEtapas((atual) => upsert(atual, novo));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approvals", filter: `mission_id=eq.${missionId}` },
        (payload) => {
          const novo = payload.new as Approval | undefined;
          if (novo) setApprovals((atual) => upsert(atual, novo));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId]);

  async function decidir(approvalId: string, decisao: "aprovar" | "rejeitar") {
    setDecidindo(approvalId);
    try {
      const res = await fetch(`/api/missoes/${missionId}/aprovacoes/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao }),
      });
      await readApiResponse(res);
      setDecididas((atual) => new Set(atual).add(approvalId));
    } catch {
      // erro silencioso o suficiente pro botão voltar ao normal; o estado real
      // vem do Realtime/banco de qualquer forma.
    } finally {
      setDecidindo(null);
    }
  }

  const aprovacaoPorEtapa = new Map(approvals.filter((a) => a.mission_step_id).map((a) => [a.mission_step_id as string, a]));
  const artefatosPorEtapa = new Map<string, Artefato[]>();
  for (const a of artefatos) {
    if (!a.missionStepId) continue;
    const lista = artefatosPorEtapa.get(a.missionStepId) ?? [];
    lista.push(a);
    artefatosPorEtapa.set(a.missionStepId, lista);
  }

  return (
    <div className="space-y-3 border-l border-areia/10 pl-5">
      {etapas.map((etapa) => {
        const aprovacao = aprovacaoPorEtapa.get(etapa.id);
        const pendente = aprovacao?.status === "pending" && !decididas.has(aprovacao.id);
        const artefatosDaEtapa = artefatosPorEtapa.get(etapa.id) ?? [];

        return (
          <div key={etapa.id} className="relative rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
            <span
              className={`absolute top-5 -left-[25px] size-2 rounded-full ${COR_STATUS[etapa.status] ?? "bg-areia/20"}`}
            />
            <p className="text-sm text-areia">{frasePorEtapa(etapa)}</p>

            {artefatosDaEtapa.length > 0 && (
              <div className="mt-3 space-y-2">
                {artefatosDaEtapa.map((art) => (
                  <div key={art.id} className="rounded-xl border border-areia/10 bg-petroleo/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">
                        {LABEL_TIPO_ARTEFATO[art.type] ?? art.type} — {art.title}
                      </p>
                      {art.url && (
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 font-mono text-[11px] text-menta underline underline-offset-2 hover:text-menta-forte"
                        >
                          {art.type === "video" || art.type === "image" ? "abrir" : "baixar"}
                        </a>
                      )}
                    </div>
                    {art.type === "video" && art.url && (
                      <video src={art.url} controls className="mt-2 max-h-64 w-full rounded-lg" />
                    )}
                    {art.type === "image" && art.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art.url} alt={art.title} className="mt-2 max-h-64 rounded-lg" />
                    )}
                    {art.content && (
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-areia/70">{art.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

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
