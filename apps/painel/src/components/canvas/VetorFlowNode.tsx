"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RÓTULO_TIPO, COR_TIPO, type VetorNodeData } from "@/lib/canvas/types";
import { ICONE_TIPO } from "./nodeIcons";

const RÓTULO_ESTADO: Record<VetorNodeData["estado"], string> = {
  idle: "não iniciado",
  processando: "processando",
  pronto: "pronto",
  erro: "erro",
  aguardando_aprovacao: "aguardando aprovação",
  aprovado: "aprovado",
};

const COR_ESTADO: Record<VetorNodeData["estado"], string> = {
  idle: "color-mix(in oklab, var(--color-areia) 30%, transparent)",
  processando: "var(--color-ambar)",
  pronto: "var(--color-menta)",
  erro: "var(--color-coral)",
  aguardando_aprovacao: "var(--color-ambar)",
  aprovado: "var(--color-menta)",
};

// Node único e genérico (Fase 3 do VETOR Manager V2) — todos os 12 tipos
// do Creative Canvas usam este mesmo componente, parametrizado por
// data.tipo (cor/rótulo) e data.estado (badge). Evita 12 componentes quase
// idênticos; o painel de propriedades (CreativeCanvasEditor.tsx) é onde a
// configuração específica de cada tipo realmente muda.
//
// Design V2 (auditoria Gravyx) — layout do card redesenhado: badge de ícone
// circular no cabeçalho, indicador de estado como ponto colorido (não só
// texto), glow ambiente mais forte quando selecionado — dá o "ar de
// tecnologia" pedido sem copiar cor/ícone/texto do produto auditado.
export default function VetorFlowNode({ data, selected }: NodeProps & { data: VetorNodeData }) {
  const cor = COR_TIPO[data.tipo];
  const corEstado = COR_ESTADO[data.estado];

  return (
    <div
      className="min-w-[210px] rounded-2xl border bg-petroleo-2/90 px-3.5 py-3 backdrop-blur-md transition-shadow"
      style={{
        borderColor: selected ? cor : "color-mix(in oklab, var(--color-areia) 12%, transparent)",
        boxShadow: selected
          ? `0 0 0 1px ${cor}, 0 0 28px -8px ${cor}`
          : "0 10px 28px -20px oklch(0 0 0 / 0.8)",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: cor, width: 8, height: 8, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: cor, width: 8, height: 8, border: "none" }} />

      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${cor} 16%, transparent)`, color: cor }}
        >
          <span className="size-[15px]">{ICONE_TIPO[data.tipo]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-areia" title={data.titulo}>
            {data.titulo}
          </p>
          <span className="mono-label text-[9px]" style={{ color: cor }}>
            {RÓTULO_TIPO[data.tipo]}
          </span>
        </div>
        <span
          className={`size-2 shrink-0 rounded-full ${data.estado === "processando" ? "animate-pulse" : ""}`}
          style={{ background: corEstado }}
          title={RÓTULO_ESTADO[data.estado]}
        />
      </div>

      {data.descricao && <p className="mt-1.5 line-clamp-2 text-[11px] text-areia/50">{data.descricao}</p>}

      {data.tipo === "resultado" && data.resultado && !data.resultado.mock && (data.resultado.variacoes.length > 1 || (data.resultado.custoCentavos ?? 0) > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {data.resultado.variacoes.length > 1 && (
            <span className="rounded-full border border-areia/15 px-1.5 py-0.5 text-[9px] text-areia/50">
              {data.resultado.variacoes.length} variações
            </span>
          )}
          {(data.resultado.custoCentavos ?? 0) > 0 && (
            <span className="rounded-full border border-ambar/30 bg-ambar/10 px-1.5 py-0.5 text-[9px] text-ambar/80">
              R$ {(data.resultado.custoCentavos! / 100).toFixed(2)}
            </span>
          )}
        </div>
      )}

      {data.tipo === "resultado" && (
        <div className="mt-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-petroleo/60">
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

      {data.erro && <p className="mt-1.5 line-clamp-2 text-[10px] text-coral">{data.erro}</p>}
    </div>
  );
}
