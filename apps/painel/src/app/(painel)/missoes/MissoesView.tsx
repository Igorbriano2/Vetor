"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

interface Missao {
  id: string;
  titulo: string;
  objetivo: string;
  status: string;
  created_at: string;
}

// Design V2 (auditoria Gravyx — "Tarefas") — Gravyx tem um board Kanban
// genérico (A fazer/Em andamento/Concluído) pra tarefas soltas, que o
// usuário arrasta livremente entre colunas. O Vetor não tem — e não pode
// ter um Kanban livre: o status de uma missão é governado pela máquina de
// estados real do Mission Orchestrator (apps/agentes/src/missions/
// stateMachine.ts), nunca escolhido arbitrariamente pelo cliente. Esta
// visão é só uma REAGRUPAMENTO visual dos 12 status reais em 5 colunas
// operacionais — sempre somente leitura, clicar no card abre a missão de
// verdade (mesmo destino da visão em lista). Nenhum drag-and-drop de
// status: isso violaria as transições válidas da state machine.
const COLUNAS: Array<{ chave: string; titulo: string; status: string[] }> = [
  { chave: "planejamento", titulo: "Planejamento", status: ["draft", "understanding", "awaiting_clarification", "planned"] },
  { chave: "aprovacao", titulo: "Aguardando aprovação", status: ["awaiting_approval", "awaiting_evidence"] },
  { chave: "execucao", titulo: "Em execução", status: ["queued", "running", "replanning", "quality_review"] },
  { chave: "concluida", titulo: "Concluídas", status: ["completed", "completed_with_caveats"] },
  { chave: "atencao", titulo: "Precisa de atenção", status: ["blocked", "failed", "cancelled"] },
];

function CardMissao({ m }: { m: Missao }) {
  return (
    <Link
      href={`/missoes/${m.id}`}
      className="card-lift block rounded-xl border border-areia/10 bg-petroleo-2/60 p-3 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-areia">{m.titulo}</p>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-areia/50">{m.objetivo}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusBadge status={m.status} />
        <span className="font-mono text-[10px] text-areia/30">{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
    </Link>
  );
}

export default function MissoesView({ missoes }: { missoes: Missao[] }) {
  const [visao, setVisao] = useState<"lista" | "kanban">("kanban");

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => setVisao("kanban")}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${visao === "kanban" ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/60 hover:border-menta/40"}`}
        >
          Kanban
        </button>
        <button
          onClick={() => setVisao("lista")}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${visao === "lista" ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/60 hover:border-menta/40"}`}
        >
          Lista
        </button>
      </div>

      {!missoes.length ? (
        <p className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
          Nenhuma missão ainda. Peça algo pro Vetor no chat do dashboard pra começar.
        </p>
      ) : visao === "kanban" ? (
        <div className="mt-6 grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
          {COLUNAS.map((col) => {
            const itens = missoes.filter((m) => col.status.includes(m.status));
            return (
              <div key={col.chave} className="min-w-[220px] space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="mono-label text-[10px] text-areia/40">{col.titulo}</h3>
                  <span className="font-mono text-[10px] text-areia/30">{itens.length}</span>
                </div>
                <div className="space-y-2">
                  {itens.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-areia/10 p-3 text-center text-[11px] text-areia/25">vazio</p>
                  ) : (
                    itens.map((m) => <CardMissao key={m.id} m={m} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {missoes.map((m) => (
            <Link
              key={m.id}
              href={`/missoes/${m.id}`}
              className="block rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-areia">{m.titulo}</p>
                <StatusBadge status={m.status} />
              </div>
              <p className="mt-1 text-sm text-areia/60">{m.objetivo}</p>
              <p className="mt-2 font-mono text-[11px] text-areia/30">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
