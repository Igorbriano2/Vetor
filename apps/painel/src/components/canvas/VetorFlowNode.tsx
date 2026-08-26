"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RÓTULO_TIPO, COR_TIPO, type VetorNodeData } from "@/lib/canvas/types";
import { ICONE_TIPO } from "./nodeIcons";
import { ESTILOS_VISUAIS } from "@/lib/design/receitasAgencia";

const LABEL_PROVIDER: Record<string, string> = { openai: "OpenAI", gemini: "Gemini" };

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

      {/* Design V2 (auditoria Gravyx) — cada tipo com campo estruturado
          mostra o valor real como chip/thumbnail no card, não só no
          painel — dá pra escanear o grafo sem abrir cada node. */}
      {data.tipo === "arquivo" &&
        (data.arquivoUrl && data.arquivoMimeType?.startsWith("image/") ? (
          <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg bg-petroleo/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.arquivoUrl} alt={data.arquivoNome ?? "arquivo"} className="size-full object-cover" />
          </div>
        ) : data.arquivoNome ? (
          <span className="mt-1.5 inline-block rounded-full border border-menta/30 bg-menta/10 px-1.5 py-0.5 text-[9px] text-menta">{data.arquivoNome}</span>
        ) : null)}
      {data.tipo === "referencia" && data.referenciaTitulo && (
        <span className="mt-1.5 inline-block rounded-full border border-menta/30 bg-menta/10 px-1.5 py-0.5 text-[9px] text-menta">{data.referenciaTitulo}</span>
      )}
      {data.tipo === "brandkit" && (data.brandkitAssetNomes?.length ?? 0) > 0 && (
        <span className="mt-1.5 inline-block rounded-full border border-ambar/30 bg-ambar/10 px-1.5 py-0.5 text-[9px] text-ambar">
          {data.brandkitAssetNomes!.length} ativo{data.brandkitAssetNomes!.length > 1 ? "s" : ""}
        </span>
      )}
      {data.tipo === "direcao_arte" && data.direcaoArteEstilo && (
        <span className="mt-1.5 inline-block rounded-full border border-electric/30 bg-electric/10 px-1.5 py-0.5 text-[9px] text-electric">
          {ESTILOS_VISUAIS.find((e) => e.valor === data.direcaoArteEstilo)?.label ?? data.direcaoArteEstilo}
        </span>
      )}
      {data.tipo === "provider" && data.providerPreferido && (
        <span className="mt-1.5 inline-block rounded-full border border-areia/20 px-1.5 py-0.5 text-[9px] text-areia/60">{LABEL_PROVIDER[data.providerPreferido]}</span>
      )}
      {data.tipo === "critica" && data.criticaResumo && (
        <span className={`mt-1.5 flex items-center gap-1 text-[9px] ${data.criticaResumo.passed ? "text-menta" : "text-coral"}`}>
          <span className={`size-1.5 rounded-full ${data.criticaResumo.passed ? "bg-menta" : "bg-coral"}`} />
          {data.criticaResumo.passed ? "aprovado no critic" : `${data.criticaResumo.issuesCount} pendência${data.criticaResumo.issuesCount === 1 ? "" : "s"}`}
        </span>
      )}

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
