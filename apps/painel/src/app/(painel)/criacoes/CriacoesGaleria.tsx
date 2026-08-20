"use client";

import { useState } from "react";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import EntregasPainel from "../entregas/EntregasPainel";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";
import type { CampanhaDeEntregas } from "@/lib/artifacts/agruparPorCampanha";

const STATUS_RASCUNHO = ["draft", "rascunho", "pending", "ready"];
const STATUS_APROVADA = ["approved", "aprovado", "completed", "completed_with_caveats"];

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "imagens", label: "Imagens" },
  { id: "videos", label: "Vídeos" },
  { id: "copies", label: "Copies" },
  { id: "campanhas", label: "Campanhas" },
  { id: "rascunhos", label: "Rascunhos" },
  { id: "aprovadas", label: "Aprovadas" },
] as const;

type FiltroId = (typeof FILTROS)[number]["id"];

// Fase 3 do Vetor Manager — galeria única da área Criações. Unifica a
// ENTRADA de Design/Videomaker/Referências/Templates/Entregas, sem
// reescrever nenhum desses departamentos: "campanhas" reaproveita
// EntregasPainel.tsx tal como já existia, os outros filtros só recortam a
// mesma lista de artefatos que /design e /videomaker já consultavam.
export default function CriacoesGaleria({
  artefatos,
  campanhas,
}: {
  artefatos: ArtefatoBiblioteca[];
  campanhas: CampanhaDeEntregas[];
}) {
  const [filtro, setFiltro] = useState<FiltroId>("todas");

  const filtrados = (() => {
    switch (filtro) {
      case "imagens":
        return artefatos.filter((a) => a.type === "image");
      case "videos":
        return artefatos.filter((a) => a.type === "video");
      case "copies":
        return artefatos.filter((a) => a.type === "copy");
      case "rascunhos":
        return artefatos.filter((a) => STATUS_RASCUNHO.includes(a.status));
      case "aprovadas":
        return artefatos.filter((a) => STATUS_APROVADA.includes(a.status));
      default:
        return artefatos;
    }
  })();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              filtro === f.id ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/60 hover:border-menta/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {filtro === "campanhas" ? (
          <EntregasPainel campanhas={campanhas} />
        ) : (
          <ArtifactLibrary artefatos={filtrados} vazio="Nada por aqui ainda — crie uma peça ou um vídeo pra começar." />
        )}
      </div>
    </div>
  );
}
