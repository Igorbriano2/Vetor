import { calcularLayoutDoCanvas, LARGURA_NO, ALTURA_NO, type EtapaParaLayout } from "@/lib/missionCanvas/layout";
import StatusBadge from "./StatusBadge";

const AGENTE_LABEL: Record<string, string> = {
  design: "Design",
  video: "Videomaker",
  trafego: "Tráfego",
  estrategia: "Estratégia",
  growth: "Growth",
  "social-media": "Social Media",
  analitico: "Analítico",
  vetor: "Vetor",
  secretario: "Secretário",
};

// Creative Mission Canvas (Fase 3 do upgrade Gravyx, Rodada D) — visualização
// só de leitura do grafo real de uma missão: nós = mission_steps, arestas =
// depende_de. Nunca editável aqui — o chat continua sendo o único jeito de
// mudar uma missão; isto é só pra alguém enxergar de relance a ordem e o
// andamento, exatamente como o prompt mestre do upgrade define o Canvas
// (opcional, complementar ao chat, nunca o substitui).
export default function MissionCanvas({ etapas }: { etapas: EtapaParaLayout[] }) {
  if (etapas.length === 0) return null;

  const layout = calcularLayoutDoCanvas(etapas);

  return (
    <div className="overflow-x-auto rounded-2xl border border-areia/10 bg-petroleo-2/40 p-6">
      <div className="relative" style={{ width: layout.largura, height: layout.altura, minWidth: "100%" }}>
        <svg className="pointer-events-none absolute inset-0" width={layout.largura} height={layout.altura}>
          {layout.arestas.map((aresta) => {
            const de = layout.nos.find((n) => n.id === aresta.deId);
            const para = layout.nos.find((n) => n.id === aresta.paraId);
            if (!de || !para) return null;
            const x1 = de.x + LARGURA_NO;
            const y1 = de.y + ALTURA_NO / 2;
            const x2 = para.x;
            const y2 = para.y + ALTURA_NO / 2;
            const meio = (x1 + x2) / 2;
            return (
              <path
                key={`${aresta.deId}-${aresta.paraId}`}
                d={`M ${x1} ${y1} C ${meio} ${y1}, ${meio} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--color-areia)"
                strokeOpacity={0.2}
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {layout.nos.map((no) => (
          <div
            key={no.id}
            className="absolute flex flex-col gap-1.5 rounded-xl border border-areia/15 bg-petroleo-3/80 p-3"
            style={{ left: no.x, top: no.y, width: LARGURA_NO, height: ALTURA_NO }}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="mono-label truncate text-menta">{AGENTE_LABEL[no.agente] ?? no.agente}</span>
              <StatusBadge status={no.status} />
            </div>
            <p className="line-clamp-2 text-xs text-areia/60">{no.tarefa}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
