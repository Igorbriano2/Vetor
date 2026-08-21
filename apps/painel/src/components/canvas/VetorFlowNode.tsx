"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RÓTULO_TIPO, COR_TIPO, type VetorNodeData } from "@/lib/canvas/types";

const RÓTULO_ESTADO: Record<VetorNodeData["estado"], string> = {
  idle: "não iniciado",
  processando: "processando",
  pronto: "pronto",
  erro: "erro",
  aguardando_aprovacao: "aguardando aprovação",
  aprovado: "aprovado",
};

// Node único e genérico (Fase 3 do VETOR Manager V2) — todos os 12 tipos
// do Creative Canvas usam este mesmo componente, parametrizado por
// data.tipo (cor/rótulo) e data.estado (badge). Evita 12 componentes quase
// idênticos; o painel de propriedades (CreativeCanvasEditor.tsx) é onde a
// configuração específica de cada tipo realmente muda.
export default function VetorFlowNode({ data, selected }: NodeProps & { data: VetorNodeData }) {
  const cor = COR_TIPO[data.tipo];

  return (
    <div
      className="min-w-[190px] rounded-xl border bg-petroleo-2/90 px-3 py-2.5 backdrop-blur"
      style={{ borderColor: selected ? cor : "color-mix(in oklab, var(--color-areia) 12%, transparent)", boxShadow: selected ? `0 0 0 1px ${cor}` : undefined }}
    >
      <Handle type="target" position={Position.Left} style={{ background: cor, width: 8, height: 8, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: cor, width: 8, height: 8, border: "none" }} />

      <div className="flex items-center justify-between gap-2">
        <span className="mono-label" style={{ color: cor }}>
          {RÓTULO_TIPO[data.tipo]}
        </span>
        {data.tipo === "resultado" && data.resultado && !data.resultado.mock && data.resultado.variacoes.length > 1 && (
          <span className="text-[10px] text-areia/40">{data.resultado.variacoes.length} variações</span>
        )}
        {data.tipo === "resultado" && data.resultado && !data.resultado.mock && (data.resultado.custoCentavos ?? 0) > 0 && (
          <span className="text-[10px] text-ambar/70">R$ {(data.resultado.custoCentavos! / 100).toFixed(2)}</span>
        )}
      </div>

      <p className="mt-1 truncate text-sm text-areia" title={data.titulo}>
        {data.titulo}
      </p>
      {data.descricao && <p className="mt-0.5 line-clamp-2 text-[11px] text-areia/50">{data.descricao}</p>}

      {data.tipo === "resultado" && (
        <div className="mt-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-petroleo/60">
          {data.resultado?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.resultado.thumbnailUrl} alt={data.titulo} className="size-full object-cover" />
          ) : data.estado === "processando" ? (
            <span className="animate-pulse text-[10px] text-areia/40">processando...</span>
          ) : (
            <span className="text-[10px] text-areia/30">{data.resultado?.mock ? "saída mock" : "sem resultado ainda"}</span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`mono-label text-[9px] ${
            data.estado === "erro" ? "text-coral" : data.estado === "pronto" || data.estado === "aprovado" ? "text-menta" : "text-areia/40"
          }`}
        >
          {RÓTULO_ESTADO[data.estado]}
        </span>
      </div>
      {data.erro && <p className="mt-1 text-[10px] text-coral">{data.erro}</p>}
    </div>
  );
}
