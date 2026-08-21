// Fase 9 do Design V2 — extraído de ArtifactLibrary.tsx (Fase 2 do Vetor
// Manager UX) pra virar uma função pura testável. Decide o rótulo mostrado
// quando um artefato NÃO tem preview real (sem url, ou tipo que nunca tem
// preview visual, ex: copy/document) — critério 11 da Fase 10 (nenhum
// thumbnail falso, e nunca confundir "falhou" com "aguardando").

export const LABEL_TIPO: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  copy: "Copy",
  document: "Documento",
  report: "Relatório",
  plan: "Plano",
  campaign_snapshot: "Campanha",
};

const STATUS_EM_ANDAMENTO = ["draft", "pending", "ready", "running", "processing", "awaiting_approval"];

export function rotuloDoPlaceholder(status: string, tipo: string): string {
  if (status?.toLowerCase().includes("fail")) return "Falhou na geração";
  if ((tipo === "image" || tipo === "video") && STATUS_EM_ANDAMENTO.includes(status)) return "Aguardando geração";
  return LABEL_TIPO[tipo] ?? tipo;
}
