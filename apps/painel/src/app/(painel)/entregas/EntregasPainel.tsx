"use client";

import { useMemo, useState } from "react";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";

const FILTROS: Array<{ id: string; label: string; departamentos?: string[] }> = [
  { id: "tudo", label: "Tudo" },
  { id: "design", label: "Design", departamentos: ["design"] },
  { id: "video", label: "Vídeo", departamentos: ["videomaker"] },
  { id: "planejamento", label: "Planejamento", departamentos: ["planejamento"] },
  { id: "trafego", label: "Campanhas", departamentos: ["trafego"] },
  { id: "conteudo", label: "Resultados", departamentos: ["conteudo"] },
];

// Entregas é espelho, não origem de dado — só filtra o que já existe em
// `artifacts` (gerado por Design/Videomaker/Planejamento/Tráfego/Conteúdo)
// por departamento; nunca duplica a escrita.
export default function EntregasPainel({ artefatos }: { artefatos: ArtefatoBiblioteca[] }) {
  const [filtro, setFiltro] = useState("tudo");

  const filtrados = useMemo(() => {
    const config = FILTROS.find((f) => f.id === filtro);
    if (!config?.departamentos) return artefatos;
    return artefatos.filter((a) => config.departamentos!.includes(a.department));
  }, [artefatos, filtro]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              filtro === f.id ? "border-menta text-menta bg-menta/10" : "border-areia/15 text-areia/60 hover:border-menta/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <ArtifactLibrary artefatos={filtrados} vazio="Nada por aqui ainda." />
      </div>
    </div>
  );
}
