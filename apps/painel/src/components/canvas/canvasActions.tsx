"use client";

import { createContext, useContext } from "react";
import type { Node } from "@xyflow/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VetorNodeData } from "@/lib/canvas/types";

export type NodeV = Node<VetorNodeData>;

// Design V2 (auditoria node-a-node do Gravyx, 2ª rodada) — achado central:
// no Gravyx NÃO existe painel lateral. Cada node é a própria superfície de
// edição — clica no dropzone dentro do card, digita no textarea dentro do
// card, escolhe o modelo no chip dentro do cabeçalho do card. As ações
// genéricas (duplicar/resetar/renomear/excluir) ficam atrás de um "⋮" no
// canto do PRÓPRIO card, nunca numa barra lateral separada. Este contexto
// existe só pra dar a cada node acesso aos handlers do editor sem prop-
// drilling através do NodeProps do React Flow (que só repassa id/data/
// selected) — nunca guardado em `data` (que é serializado pro
// graph_json, funções não podem ir pro banco).
export interface CanvasActions {
  clienteId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  onPatch: (nodeId: string, patch: Partial<VetorNodeData>) => void;
  onDuplicar: (nodeId: string) => void;
  onRemover: (nodeId: string) => void;
  onReprocessar: (nodeId: string) => void;
  onGerarPecaReal: (nodeId: string) => void;
  onAtualizarResultadoReal: (nodeId: string) => void;
  resultadoConectado: (nodeId: string) => NodeV | null;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function useCanvasActions(): CanvasActions {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) throw new Error("useCanvasActions só pode ser usado dentro de CanvasActionsContext.Provider");
  return ctx;
}
