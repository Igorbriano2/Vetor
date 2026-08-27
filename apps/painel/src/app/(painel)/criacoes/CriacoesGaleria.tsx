"use client";

import { useMemo, useState } from "react";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import EntregasPainel from "../entregas/EntregasPainel";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";
import type { CampanhaDeEntregas } from "@/lib/artifacts/agruparPorCampanha";

const STATUS_RASCUNHO = ["draft", "rascunho", "pending", "ready"];
const STATUS_APROVADA = ["approved", "aprovado", "completed", "completed_with_caveats"];

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "imagens", label: "Imagens" },
  { id: "videos", label: "Vídeos" },
  { id: "carrosseis", label: "Carrosséis" },
  { id: "campanhas", label: "Campanhas" },
  { id: "rascunhos", label: "Rascunhos" },
  { id: "aprovados", label: "Aprovados" },
] as const;

type FiltroId = (typeof FILTROS)[number]["id"];

// Design V2 (prompt "reconstrução seletiva") — Fase 1: galeria visual de
// Criações. Continua a mesma base de dados de sempre (artefatos reais +
// EntregasPainel pra campanhas), agora com busca e filtro por
// campanha/workspace. Só mostra peça concluída — "em produção"/"com falha"
// foi removido daqui (reorganização de menus): esse estado já vive nos
// workspaces de /design e /videomaker, mostrar aqui também era duplicação.
// "Carrosséis" não é um artifacts.type próprio (schema: image/video/copy/
// document/report/plan/campaign_snapshot) — o formato "carrossel" vem do
// briefing (CriarPecaWizard) e fica só no título/descrição do artefato, daí
// o filtro procurar por texto em vez de coluna estruturada: nunca fabrica
// um dado que o schema não tem, só usa o que já existe.
export default function CriacoesGaleria({
  artefatos,
  campanhas,
}: {
  artefatos: ArtefatoBiblioteca[];
  campanhas: CampanhaDeEntregas[];
}) {
  const [filtro, setFiltro] = useState<FiltroId>("todos");
  const [busca, setBusca] = useState("");
  const [campanhaId, setCampanhaId] = useState("");

  const filtrados = useMemo(() => {
    let lista = artefatos;
    switch (filtro) {
      case "imagens":
        lista = lista.filter((a) => a.type === "image");
        break;
      case "videos":
        lista = lista.filter((a) => a.type === "video");
        break;
      case "carrosseis":
        lista = lista.filter((a) => /carross/i.test(`${a.title} ${a.description ?? ""}`));
        break;
      case "rascunhos":
        lista = lista.filter((a) => STATUS_RASCUNHO.includes(a.status));
        break;
      case "aprovados":
        lista = lista.filter((a) => STATUS_APROVADA.includes(a.status));
        break;
      default:
        break;
    }
    if (campanhaId) lista = lista.filter((a) => a.missionId === campanhaId);
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      lista = lista.filter((a) => a.title.toLowerCase().includes(termo) || (a.description ?? "").toLowerCase().includes(termo));
    }
    return lista;
  }, [artefatos, filtro, campanhaId, busca]);

  const campanhasComNome = campanhas.filter((c) => c.missionId);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="ml-auto flex flex-wrap gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            className="rounded-full border border-areia/15 bg-petroleo-3/60 px-3 py-1.5 text-xs text-areia placeholder:text-areia/30 focus:border-menta/40 focus:outline-none"
          />
          {campanhasComNome.length > 0 && (
            <select
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
              className="rounded-full border border-areia/15 bg-petroleo-3/60 px-3 py-1.5 text-xs text-areia focus:border-menta/40 focus:outline-none"
            >
              <option value="">Todas as campanhas</option>
              {campanhasComNome.map((c) => (
                <option key={c.missionId} value={c.missionId as string}>
                  {c.titulo}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtro === "campanhas" ? (
        <div className="mt-5">
          <EntregasPainel campanhas={campanhas} />
        </div>
      ) : (
        <section className="mt-6">
          <ArtifactLibrary artefatos={filtrados} vazio="Nada por aqui ainda — crie uma peça ou um vídeo pra começar." />
        </section>
      )}
    </div>
  );
}
