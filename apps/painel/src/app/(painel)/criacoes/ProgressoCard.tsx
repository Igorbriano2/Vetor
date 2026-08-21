import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import type { PecaEmProgresso } from "@/lib/artifacts/buscarPecasEmProgresso";

const LABEL_AGENTE: Record<string, string> = { design: "Imagem", video: "Vídeo" };

// Design V2 Fase 1 — cartão dedicado pras duas faixas que nunca devem se
// misturar com "Concluídas": nunca mostra thumbnail (não existe ainda),
// nunca finge estar pronto. "Com falha" mostra a causa resumida real
// (agent_runs.erro) e um link direto pra missão — retomar/tentar de novo
// acontece na conversa da missão, não um botão novo que reimplementaria o
// Mission Orchestrator.
export default function ProgressoCard({ peca, falha }: { peca: PecaEmProgresso; falha?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border p-4 backdrop-blur ${
        falha ? "border-coral/30 bg-coral/5" : "border-areia/10 bg-petroleo-2/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-areia/40">{LABEL_AGENTE[peca.agente] ?? peca.agente}</span>
        <StatusBadge status={peca.status} />
      </div>
      <p className="text-sm font-medium text-areia">{peca.tarefa}</p>
      <p className="text-xs text-areia/50">{peca.missionTitulo}</p>
      {falha && peca.erroResumo && (
        <p className="line-clamp-2 rounded-lg bg-petroleo-3/60 p-2 text-xs text-coral/90">{peca.erroResumo}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span className="font-mono text-[10px] text-areia/30">{new Date(peca.createdAt).toLocaleDateString("pt-BR")}</span>
        <Link
          href={`/missoes/${peca.missionId}`}
          className="font-mono text-[11px] text-menta underline underline-offset-2 hover:text-menta-forte"
        >
          {falha ? "tentar de novo na missão" : "ver missão"}
        </Link>
      </div>
    </div>
  );
}
