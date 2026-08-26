"use client";

import { useState } from "react";
import Link from "next/link";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import StatusBadge from "@/components/StatusBadge";
import type { CampanhaDeEntregas } from "@/lib/artifacts/agruparPorCampanha";

const ABAS: Array<{ id: string; label: string; departamentos?: string[] }> = [
  { id: "tudo", label: "Tudo" },
  { id: "design", label: "Design", departamentos: ["design"] },
  { id: "video", label: "Vídeo", departamentos: ["videomaker"] },
  { id: "copy", label: "Copy", departamentos: ["conteudo"] },
  { id: "planejamento", label: "Planejamento", departamentos: ["planejamento"] },
  { id: "resultados", label: "Resultados", departamentos: ["trafego"] },
];

// Fase 6 do reset de produto — Entregas é espelho, não origem de dado (só
// agrupa o que já existe em `artifacts`/`video_projects` por campanha, ver
// agruparPorCampanha.ts). Cada campanha abre com abas por departamento;
// nunca duplica a escrita.
export default function EntregasPainel({ campanhas }: { campanhas: CampanhaDeEntregas[] }) {
  const [campanhaAberta, setCampanhaAberta] = useState<string | null>(campanhas[0]?.missionId ?? null);

  if (campanhas.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
        Nada por aqui ainda.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {campanhas.map((c) => {
        const aberta = campanhaAberta === (c.missionId ?? "sem-campanha");
        return (
          <div key={c.missionId ?? "sem-campanha"} className="overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/60">
            <button
              onClick={() => setCampanhaAberta(aberta ? null : (c.missionId ?? "sem-campanha"))}
              className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-petroleo-3/30"
            >
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-menta/20 to-petroleo">
                {c.capaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.capaUrl} alt={c.titulo} className="size-full object-cover" />
                ) : (
                  <span className="text-[10px] text-areia/40">sem capa</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-areia">{c.titulo}</p>
                  {c.status && <StatusBadge status={c.status} />}
                </div>
                {c.objetivo && <p className="mt-0.5 truncate text-xs text-areia/50">{c.objetivo}</p>}
                <p className="mt-0.5 font-mono text-[10px] text-areia/30">
                  {c.artefatos.length} {c.artefatos.length === 1 ? "peça" : "peças"}
                  {c.createdAt && ` · ${new Date(c.createdAt).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              {c.missionId && (
                <Link
                  href={`/missoes/${c.missionId}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className="shrink-0 font-mono text-[11px] text-menta hover:underline"
                >
                  ver missão
                </Link>
              )}
              <span className="shrink-0 text-areia/30">{aberta ? "▲" : "▼"}</span>
            </button>

            {aberta && <CampanhaAbas artefatos={c.artefatos} />}
          </div>
        );
      })}
    </div>
  );
}

function CampanhaAbas({ artefatos }: { artefatos: CampanhaDeEntregas["artefatos"] }) {
  const [aba, setAba] = useState("tudo");
  const filtrados = (() => {
    const config = ABAS.find((a) => a.id === aba);
    if (!config?.departamentos) return artefatos;
    return artefatos.filter((a) => config.departamentos!.includes(a.department));
  })();

  return (
    <div className="border-t border-areia/10 p-4">
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              aba === a.id ? "border-menta text-menta bg-menta/10" : "border-areia/15 text-areia/60 hover:border-menta/40"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <ArtifactLibrary artefatos={filtrados} vazio="Nada por aqui ainda." />
      </div>
    </div>
  );
}
