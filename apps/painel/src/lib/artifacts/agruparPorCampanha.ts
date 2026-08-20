import type { ArtefatoBiblioteca } from "./fetchArtifacts";

export interface CampanhaDeEntregas {
  missionId: string | null;
  titulo: string;
  objetivo: string | null;
  status: string | null;
  createdAt: string;
  capaUrl: string | null;
  artefatos: ArtefatoBiblioteca[];
}

const ORDEM_TIPO_VISUAL_PRIMEIRO: Record<string, number> = { image: 0, video: 0, report: 1, plan: 1, document: 2, copy: 2 };

// Fase 6 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — Entregas deixa
// de ser um grid único de artefatos soltos e vira uma galeria por campanha
// (missão). Pura, sem I/O — `artefatos` já vem com missionId/missionTitulo
// resolvidos (ver fetchArtifacts.ts), `missoes` traz objetivo/status que o
// artefato sozinho não carrega.
export function agruparPorCampanha(
  artefatos: ArtefatoBiblioteca[],
  missoes: Array<{ id: string; objetivo: string | null; status: string | null; createdAt: string }>,
): CampanhaDeEntregas[] {
  const missaoPorId = new Map(missoes.map((m) => [m.id, m]));
  const porMissao = new Map<string, ArtefatoBiblioteca[]>();
  const semMissao: ArtefatoBiblioteca[] = [];

  for (const a of artefatos) {
    if (!a.missionId) {
      semMissao.push(a);
      continue;
    }
    const lista = porMissao.get(a.missionId) ?? [];
    lista.push(a);
    porMissao.set(a.missionId, lista);
  }

  const campanhas: CampanhaDeEntregas[] = Array.from(porMissao.entries()).map(([missionId, itens]) => {
    const ordenados = [...itens].sort((x, y) => (ORDEM_TIPO_VISUAL_PRIMEIRO[x.type] ?? 3) - (ORDEM_TIPO_VISUAL_PRIMEIRO[y.type] ?? 3));
    const capa = ordenados.find((a) => (a.type === "image" || a.type === "video") && a.url);
    const missao = missaoPorId.get(missionId);
    return {
      missionId,
      titulo: itens[0]?.missionTitulo ?? "Campanha",
      objetivo: missao?.objetivo ?? null,
      status: missao?.status ?? null,
      createdAt: missao?.createdAt ?? itens[0]?.createdAt ?? "",
      capaUrl: capa?.url ?? null,
      artefatos: ordenados,
    };
  });

  campanhas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (semMissao.length > 0) {
    campanhas.push({
      missionId: null,
      titulo: "Sem campanha",
      objetivo: "Entregas avulsas, sem missão de origem (ex: canal legado do WhatsApp).",
      status: null,
      createdAt: semMissao[0]?.createdAt ?? "",
      capaUrl: null,
      artefatos: [...semMissao].sort((x, y) => (ORDEM_TIPO_VISUAL_PRIMEIRO[x.type] ?? 3) - (ORDEM_TIPO_VISUAL_PRIMEIRO[y.type] ?? 3)),
    });
  }

  return campanhas;
}
