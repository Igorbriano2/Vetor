// Design profissional V1, Fase 5 — espelha avaliarEditabilidade() de
// apps/agentes/src/negocio/designProjects.ts (mesma convenção de
// duplicação intencional já usada por timelineTypes.ts entre os dois
// apps: cada lado duplica só o que precisa, sem pacote compartilhado).
// Nunca finge que um PNG achatado antigo virou camadas precisas.

export interface EditabilidadeDoProjeto {
  editabilityStatus: "flat_image_legacy" | "editable_layers";
  editableLayerCount: number;
  migrationAvailable: boolean;
}

export function avaliarEditabilidade(canvasJson: unknown): EditabilidadeDoProjeto {
  const objetos = (canvasJson as { objects?: Array<{ vetorMeta?: { role?: string } }> } | null)?.objects;
  if (!Array.isArray(objetos) || objetos.length === 0) {
    return { editabilityStatus: "flat_image_legacy", editableLayerCount: 0, migrationAvailable: false };
  }

  const camadasEditaveis = objetos.filter((o) => {
    const role = o.vetorMeta?.role;
    return role === "texto" || role === "forma" || role === "produto" || role === "pessoa" || role === "elemento";
  });

  if (camadasEditaveis.length === 0) {
    return { editabilityStatus: "flat_image_legacy", editableLayerCount: 0, migrationAvailable: true };
  }

  return { editabilityStatus: "editable_layers", editableLayerCount: camadasEditaveis.length, migrationAvailable: false };
}
