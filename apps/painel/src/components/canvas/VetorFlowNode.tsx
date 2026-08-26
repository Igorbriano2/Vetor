"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RÓTULO_TIPO, COR_TIPO, type VetorNodeData } from "@/lib/canvas/types";
import { ICONE_TIPO } from "./nodeIcons";
import { ESTILOS_VISUAIS } from "@/lib/design/receitasAgencia";
import { useCanvasActions, type NodeV } from "./canvasActions";

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

const CAMPO = "w-full rounded-lg border border-areia/15 bg-petroleo px-2.5 py-1.5 text-xs text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none";
const ROTULO = "mono-label text-[10px] text-areia/40";

// Design V2 (auditoria node-a-node do Gravyx, 2ª rodada) — achado central
// da auditoria: NENHUM node do Gravyx abre painel lateral. O card É a
// superfície de edição inteira — dropzone dentro do card, texto dentro do
// card, seletor de modelo/IA dentro do cabeçalho do card, ações genéricas
// (duplicar/resetar/excluir) atrás de um "⋮" no canto do próprio card.
// Reescrito do zero pra reproduzir exatamente esse comportamento — nunca
// mais um "clique pra abrir o painel", tudo já editável ali. Cores/ícones
// continuam 100% do Vetor (nunca copiados do produto auditado).
export default function VetorFlowNode({ id, data, selected }: NodeProps & { data: VetorNodeData }) {
  const cor = COR_TIPO[data.tipo];
  const corEstado = COR_ESTADO[data.estado];
  const actions = useCanvasActions();
  const node: NodeV = { id, type: "vetorNode", position: { x: 0, y: 0 }, data } as NodeV;
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function fechar(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [menuAberto]);

  function patch(p: Partial<VetorNodeData>) {
    actions.onPatch(id, p);
  }

  return (
    <div
      className="min-w-[240px] max-w-[300px] rounded-2xl border bg-petroleo-2/95 p-3.5 backdrop-blur-md transition-shadow"
      style={{
        borderColor: selected ? cor : "color-mix(in oklab, var(--color-areia) 12%, transparent)",
        boxShadow: selected ? `0 0 0 1px ${cor}, 0 0 28px -8px ${cor}` : "0 10px 28px -20px oklch(0 0 0 / 0.8)",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: cor, width: 8, height: 8, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: cor, width: 8, height: 8, border: "none" }} />

      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${cor} 16%, transparent)`, color: cor }}>
          <span className="size-[15px]">{ICONE_TIPO[data.tipo]}</span>
        </span>
        <div className="nodrag min-w-0 flex-1">
          <input
            value={data.titulo}
            onChange={(e) => patch({ titulo: e.target.value })}
            className="w-full truncate border-none bg-transparent p-0 text-sm font-semibold text-areia focus:outline-none"
          />
          <span className="mono-label text-[9px]" style={{ color: cor }}>
            {RÓTULO_TIPO[data.tipo]}
          </span>
        </div>
        <span className={`size-2 shrink-0 rounded-full ${data.estado === "processando" ? "animate-pulse" : ""}`} style={{ background: corEstado }} title={RÓTULO_ESTADO[data.estado]} />

        <div ref={menuRef} className="nodrag relative shrink-0">
          <button onClick={() => setMenuAberto((a) => !a)} className="flex size-5 items-center justify-center rounded text-areia/40 hover:bg-areia/10 hover:text-areia" aria-label="Mais ações">
            ⋮
          </button>
          {menuAberto && (
            <div className="absolute right-0 top-6 z-10 w-40 rounded-xl border border-areia/10 bg-petroleo-3 p-1 shadow-2xl">
              <button
                onClick={() => {
                  actions.onReprocessar(id);
                  setMenuAberto(false);
                }}
                disabled={data.estado === "processando"}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-areia/80 hover:bg-areia/10 disabled:opacity-40"
              >
                {data.estado === "processando" ? "Processando..." : "Reprocessar (mock)"}
              </button>
              <button
                onClick={() => {
                  actions.onDuplicar(id);
                  setMenuAberto(false);
                }}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-areia/80 hover:bg-areia/10"
              >
                Duplicar
              </button>
              {data.tipo === "aprovacao" && (
                <button
                  onClick={() => {
                    patch({ estado: "aprovado" });
                    setMenuAberto(false);
                  }}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-ambar hover:bg-ambar/10"
                >
                  Aprovar
                </button>
              )}
              <button
                onClick={() => {
                  actions.onRemover(id);
                  setMenuAberto(false);
                }}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-coral hover:bg-coral/10"
              >
                Remover
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="nodrag nowheel mt-2.5 space-y-2">
        <CorpoDoNode node={node} patch={patch} />
      </div>

      {data.erro && <p className="mt-1.5 line-clamp-2 text-[10px] text-coral">{data.erro}</p>}
    </div>
  );
}

// ————— corpo por tipo — a mesma superfície de edição que antes vivia no
// painel lateral, agora direto dentro do card. —————

function CorpoDoNode({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  switch (node.data.tipo) {
    case "briefing":
      return <CorpoTexto node={node} patch={patch} placeholder="Descreva a demanda como o cliente digitaria no chat..." rows={4} />;
    case "prompt_visual":
      return <CorpoTexto node={node} patch={patch} placeholder="Composição, cores, texto na peça, estilo desejado..." rows={4} />;
    case "arquivo":
      return <CorpoArquivo node={node} patch={patch} />;
    case "referencia":
      return <CorpoReferencia node={node} patch={patch} />;
    case "brandkit":
      return <CorpoBrandkit node={node} patch={patch} />;
    case "direcao_arte":
      return <CorpoDirecaoArte node={node} patch={patch} />;
    case "provider":
      return <CorpoProvider node={node} patch={patch} />;
    case "resultado":
      return <CorpoResultado node={node} patch={patch} />;
    case "scene_graph":
      return <CorpoSceneGraph node={node} />;
    case "critica":
      return <CorpoCritica node={node} patch={patch} />;
    case "aprovacao":
      return <CorpoAprovacao node={node} />;
    case "entrega":
      return <CorpoEntrega node={node} patch={patch} />;
    default:
      return null;
  }
}

function CorpoTexto({ node, patch, placeholder, rows }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void; placeholder: string; rows: number }) {
  return <textarea value={node.data.descricao} onChange={(e) => patch({ descricao: e.target.value })} rows={rows} placeholder={placeholder} className={CAMPO} />;
}

function CorpoArquivo({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const status = node.data.arquivoStatus ?? "vazio";

  async function enviar(arquivo: File) {
    patch({ arquivoStatus: "enviando", arquivoNome: arquivo.name, arquivoMimeType: arquivo.type });
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao enviar o arquivo");
      patch({ arquivoStatus: "pronto", arquivoAssetId: data.assetId, arquivoUrl: data.url, arquivoNome: data.nome ?? arquivo.name, arquivoMimeType: data.mimeType ?? arquivo.type });
    } catch (err) {
      patch({ arquivoStatus: "erro", erro: err instanceof Error ? err.message : "Falha ao enviar" });
    }
  }

  const ehImagem = node.data.arquivoMimeType?.startsWith("image/");

  if (status === "pronto" && node.data.arquivoUrl) {
    return (
      <div className="overflow-hidden rounded-lg border border-areia/10 bg-petroleo/60">
        {ehImagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.data.arquivoUrl} alt={node.data.arquivoNome ?? "arquivo"} className="h-32 w-full object-cover" />
        ) : (
          <div className="flex h-16 items-center justify-center text-[11px] text-areia/50">{node.data.arquivoNome}</div>
        )}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="truncate text-[10px] text-areia/50">{node.data.arquivoNome}</span>
          <button onClick={() => patch({ arquivoStatus: "vazio", arquivoAssetId: undefined, arquivoUrl: null, arquivoNome: undefined, arquivoMimeType: undefined })} className="shrink-0 text-[10px] text-coral hover:underline">
            trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        if (e.dataTransfer.files[0]) void enviar(e.dataTransfer.files[0]);
      }}
      onClick={() => status !== "enviando" && inputRef.current?.click()}
      className={`flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center transition ${arrastando ? "border-menta/50 bg-menta/5" : "border-areia/20 hover:border-areia/35"}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf"
        onChange={(e) => e.target.files?.[0] && void enviar(e.target.files[0])}
      />
      <span className="text-[11px] text-areia/50">{status === "enviando" ? "Enviando..." : status === "erro" ? "Falhou — clique pra tentar de novo" : "Arraste ou clique pra enviar"}</span>
    </div>
  );
}

interface ItemReferencia {
  id: string;
  title: string;
}

function CorpoReferencia({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  const { supabase, clienteId } = useCanvasActions();
  const [itens, setItens] = useState<ItemReferencia[] | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase
      .from("reference_library_items")
      .select("id, title")
      .or(`cliente_id.eq.${clienteId},cliente_id.is.null`)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (vivo) setItens((data ?? []).map((d: { id: string; title: string }) => ({ id: d.id, title: d.title })));
      });
    return () => {
      vivo = false;
    };
  }, [supabase, clienteId]);

  return (
    <div className="space-y-2">
      {itens === null ? (
        <p className="text-[11px] text-areia/30">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-[11px] text-areia/30">Nenhuma referência cadastrada ainda.</p>
      ) : (
        <div className="max-h-28 space-y-1 overflow-y-auto">
          {itens.map((item) => (
            <button
              key={item.id}
              onClick={() => patch({ referenciaItemId: item.id, referenciaTitulo: item.title })}
              className={`block w-full truncate rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${node.data.referenciaItemId === item.id ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/30"}`}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
      <Link href="/referencias" className="inline-block text-[10px] text-menta hover:underline">
        Gerenciar em /referencias →
      </Link>
      <textarea value={node.data.descricao} onChange={(e) => patch({ descricao: e.target.value })} rows={2} placeholder="Nota: use só a paleta de cores..." className={CAMPO} />
    </div>
  );
}

interface AssetIdentidade {
  id: string;
  nome: string;
  isLogoPrincipal: boolean;
}

function CorpoBrandkit({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  const { supabase, clienteId } = useCanvasActions();
  const [ativos, setAtivos] = useState<AssetIdentidade[] | null>(null);
  const selecionados = node.data.brandkitAssetIds ?? [];

  useEffect(() => {
    let vivo = true;
    supabase
      .from("business_assets")
      .select("id, nome, is_logo_principal")
      .eq("cliente_id", clienteId)
      .eq("categoria", "identidade_visual")
      .eq("status", "aprovado")
      .order("is_logo_principal", { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (vivo) setAtivos((data ?? []).map((d: { id: string; nome: string; is_logo_principal: boolean }) => ({ id: d.id, nome: d.nome, isLogoPrincipal: d.is_logo_principal })));
      });
    return () => {
      vivo = false;
    };
  }, [supabase, clienteId]);

  function alternar(item: AssetIdentidade) {
    const jaTem = selecionados.includes(item.id);
    const novosIds = jaTem ? selecionados.filter((id) => id !== item.id) : [...selecionados, item.id];
    const novosNomes = (node.data.brandkitAssetNomes ?? []).filter((n) => n !== item.nome);
    patch({ brandkitAssetIds: novosIds, brandkitAssetNomes: jaTem ? novosNomes : [...novosNomes, item.nome] });
  }

  return (
    <div className="space-y-2">
      {ativos === null ? (
        <p className="text-[11px] text-areia/30">Carregando...</p>
      ) : ativos.length === 0 ? (
        <p className="text-[11px] text-areia/30">Nenhum ativo de identidade visual cadastrado ainda.</p>
      ) : (
        <div className="max-h-28 space-y-1 overflow-y-auto">
          {ativos.map((item) => (
            <button
              key={item.id}
              onClick={() => alternar(item)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${selecionados.includes(item.id) ? "border-ambar bg-ambar/10 text-ambar" : "border-areia/15 text-areia/70 hover:border-ambar/30"}`}
            >
              <span className="truncate">{item.nome}</span>
              {item.isLogoPrincipal && <span className="mono-label shrink-0 text-[9px] text-areia/40">logo</span>}
            </button>
          ))}
        </div>
      )}
      <Link href="/configuracoes/negocio/banco-de-imagens" className="inline-block text-[10px] text-menta hover:underline">
        Gerenciar em Banco de imagens →
      </Link>
    </div>
  );
}

function CorpoDirecaoArte({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ESTILOS_VISUAIS.map((e) => (
        <button
          key={e.valor}
          onClick={() => patch({ direcaoArteEstilo: e.valor })}
          aria-pressed={node.data.direcaoArteEstilo === e.valor}
          className={`rounded-lg border p-1.5 text-left transition ${node.data.direcaoArteEstilo === e.valor ? "border-electric bg-electric/10" : "border-areia/15 hover:border-electric/30"}`}
        >
          <p className={`text-[10px] font-medium ${node.data.direcaoArteEstilo === e.valor ? "text-electric" : "text-areia"}`}>{e.label}</p>
        </button>
      ))}
    </div>
  );
}

// Design V2 (auditoria Gravyx) — mesmo chip de modelo que o node de
// Resultado deles tem no cabeçalho ("Nano Banana 2 ▾"). Só os 2 providers
// reais de imagem hoje (apps/agentes/src/integrations/imageProvider.ts) —
// "Nano Banana" é o apelido real do modelo de imagem do Gemini, usado
// nos próprios comentários do backend.
const PROVEDORES_IMAGEM: Array<{ valor: "openai" | "gemini"; label: string }> = [
  { valor: "gemini", label: "Gemini — Nano Banana" },
  { valor: "openai", label: "OpenAI — GPT Image" },
];

function SeletorProvider({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  return (
    <select value={node.data.providerPreferido ?? ""} onChange={(e) => patch({ providerPreferido: (e.target.value || undefined) as "openai" | "gemini" | undefined })} className={`${CAMPO} font-medium`}>
      <option value="">Automático — o sistema decide</option>
      {PROVEDORES_IMAGEM.map((p) => (
        <option key={p.valor} value={p.valor}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

function CorpoProvider({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  return <SeletorProvider node={node} patch={patch} />;
}

const FORMATOS_RESULTADO = ["Feed", "Story", "Carrossel", "Capa de Reel", "Anúncio", "Outro"];

function VariacoesGrid({ variacoes, missionId }: { variacoes: NonNullable<NodeV["data"]["resultado"]>["variacoes"]; missionId: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {variacoes.map((v, i) => (
        <div key={v.designProjectId} className="overflow-hidden rounded-lg border border-areia/10 bg-petroleo/60">
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-petroleo">
            {v.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnailUrl} alt={`Variação ${i + 1}`} className="size-full object-cover" />
            ) : (
              <span className="text-[10px] text-areia/30">sem preview</span>
            )}
          </div>
          <div className="space-y-0.5 p-1.5">
            <p className="text-[10px] text-areia/40">
              {v.resolucao ?? "resolução indefinida"} {v.aspectRatio ? `· ${v.aspectRatio}` : ""}
            </p>
            <p className={`text-[10px] ${v.status === "approved" ? "text-menta" : "text-areia/50"}`}>{v.status === "approved" ? "aprovado" : v.status}</p>
            <div className="flex items-center justify-between pt-0.5">
              <Link href={`/design/editor/${v.designProjectId}`} className="text-[10px] text-menta hover:underline">
                abrir
              </Link>
              {v.status !== "approved" && missionId && (
                <Link href={`/missoes/${missionId}`} className="text-[10px] text-ambar hover:underline">
                  aprovar
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CorpoResultado({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  const actions = useCanvasActions();
  const resultado = node.data.resultado;

  return (
    <div className="space-y-2 rounded-lg border border-ambar/20 bg-ambar/5 p-2.5">
      <SeletorProvider node={node} patch={patch} />
      <div className="grid grid-cols-2 gap-2">
        <select value={node.data.formatoDesejado ?? ""} onChange={(e) => patch({ formatoDesejado: e.target.value || undefined })} className="rounded-lg border border-areia/15 bg-petroleo px-2 py-1 text-xs text-areia focus:border-menta focus:outline-none">
          <option value="">Formato: a definir</option>
          {FORMATOS_RESULTADO.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-lg border border-areia/15 bg-petroleo px-2 py-1">
          <span className={ROTULO}>Var.</span>
          <input
            type="number"
            min={1}
            max={6}
            value={node.data.variacoesDesejadas ?? 1}
            onChange={(e) => patch({ variacoesDesejadas: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
            className="w-10 bg-transparent text-xs text-areia focus:outline-none"
          />
        </label>
      </div>

      <button
        onClick={() => actions.onGerarPecaReal(node.id)}
        disabled={node.data.estado === "processando"}
        className="w-full rounded-lg border border-ambar/40 bg-ambar/10 px-2.5 py-1.5 text-[11px] font-semibold text-ambar hover:bg-ambar/20 disabled:opacity-40"
      >
        {node.data.estado === "processando" ? "Enviando ao Vetor..." : "Gerar peça real"}
      </button>

      {resultado?.missionId && (
        <div className="flex items-center justify-between gap-2">
          <Link href={`/missoes/${resultado.missionId}`} className="text-[11px] text-menta hover:underline">
            Ver e aprovar na missão →
          </Link>
          <button onClick={() => actions.onAtualizarResultadoReal(node.id)} className="text-[11px] text-areia/50 hover:text-areia">
            Atualizar
          </button>
        </div>
      )}

      {resultado && !resultado.mock && resultado.variacoes.length > 0 ? (
        <VariacoesGrid variacoes={resultado.variacoes} missionId={resultado.missionId} />
      ) : resultado && !resultado.mock ? (
        <p className="rounded-lg bg-petroleo-3/40 p-2 text-[11px] text-areia/40">
          Aguardando geração — {node.data.estado === "erro" ? "a geração falhou, veja abaixo" : "esperando a etapa de Design da missão ser aprovada e concluída"}.
        </p>
      ) : resultado?.mock ? (
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-petroleo/60">
          <span className="text-[10px] text-areia/30">saída mock</span>
        </div>
      ) : null}

      {node.data.estado === "erro" && resultado?.missionId && (
        <Link href={`/missoes/${resultado.missionId}`} className="text-[11px] text-coral hover:underline">
          Tentar de novo na missão →
        </Link>
      )}
    </div>
  );
}

function CorpoSceneGraph({ node }: { node: NodeV }) {
  const actions = useCanvasActions();
  const conectado = actions.resultadoConectado(node.id);
  const designProjectId = conectado?.data.resultado?.designProjectId;
  return (
    <p className="text-[11px] text-areia/40">
      {designProjectId ? (
        <Link href={`/design/editor/${designProjectId}`} className="text-menta hover:underline">
          Abrir Scene Graph real →
        </Link>
      ) : (
        "Disponível depois de conectar um Resultado com peça real já gerada e aprovada."
      )}
    </p>
  );
}

interface ChecklistCritic {
  [criterio: string]: boolean;
}
interface DesignCriticResultado {
  passed: boolean;
  resumo: string;
  issues: string[];
  checklist: ChecklistCritic;
}

const LABEL_CRITERIO: Record<string, string> = {
  composicaoHierarquia: "Composição",
  contraste: "Contraste",
  legibilidadeMobile: "Legibilidade",
  tipografia: "Tipografia",
  proporcao: "Proporção",
  alinhamento: "Alinhamento",
  respiroVisual: "Respiro visual",
  cta: "CTA",
  usoDaLogo: "Uso da logo",
  aderenciaBrandKit: "BrandKit",
  adequacaoAoCanal: "Canal",
  coerenciaComPedido: "Coerência",
};

function CorpoCritica({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  const actions = useCanvasActions();
  const conectado = actions.resultadoConectado(node.id);
  const designProjectId = conectado?.data.resultado?.designProjectId;
  const [critic, setCritic] = useState<DesignCriticResultado | null | "carregando">(null);
  const [ultimoDesignProjectId, setUltimoDesignProjectId] = useState<string | null | undefined>(undefined);

  if (designProjectId !== ultimoDesignProjectId) {
    setUltimoDesignProjectId(designProjectId);
    setCritic(designProjectId ? "carregando" : null);
  }

  useEffect(() => {
    if (!designProjectId) return;
    let vivo = true;
    actions.supabase
      .from("design_projects")
      .select("design_critic")
      .eq("id", designProjectId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (!vivo) return;
        const resultado = (data?.design_critic as DesignCriticResultado | null) ?? null;
        setCritic(resultado);
        if (resultado) patch({ criticaResumo: { passed: resultado.passed, issuesCount: resultado.issues?.length ?? 0 } });
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designProjectId]);

  if (!designProjectId) return <p className="text-[11px] text-areia/40">Disponível depois de conectar um Resultado com peça real já gerada.</p>;
  if (critic === "carregando") return <p className="text-[11px] text-areia/30">Carregando avaliação...</p>;
  if (!critic) return <p className="text-[11px] text-areia/30">Esta peça ainda não passou pela avaliação automática.</p>;

  return (
    <div className="space-y-2">
      <div className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${critic.passed ? "border-menta/30 bg-menta/10 text-menta" : "border-coral/30 bg-coral/10 text-coral"}`}>
        {critic.passed ? "Aprovada" : "Reprovada"} — {critic.resumo}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {Object.entries(critic.checklist ?? {}).map(([chave, ok]) => (
          <div key={chave} className="flex items-center gap-1.5">
            <span className={`size-1.5 shrink-0 rounded-full ${ok ? "bg-menta" : "bg-coral"}`} />
            <span className="truncate text-[10px] text-areia/60">{LABEL_CRITERIO[chave] ?? chave}</span>
          </div>
        ))}
      </div>
      {critic.issues?.length > 0 && (
        <div className="space-y-1">
          {critic.issues.map((issue, i) => (
            <p key={i} className="rounded-2xl rounded-tl-md border border-coral/20 bg-coral/5 px-3 py-2 text-[11px] text-coral/90">
              {issue}
            </p>
          ))}
        </div>
      )}
      <textarea
        value={node.data.descricao}
        onChange={(e) => patch({ descricao: e.target.value })}
        rows={2}
        placeholder="Sua nota além da avaliação automática..."
        className={`${CAMPO} rounded-2xl rounded-tr-md border-menta/20 bg-menta/10`}
      />
    </div>
  );
}

function CorpoAprovacao({ node }: { node: NodeV }) {
  const actions = useCanvasActions();
  const conectado = actions.resultadoConectado(node.id);
  const resultado = conectado?.data.resultado;

  if (!resultado || resultado.mock) return <p className="text-[11px] text-areia/40">Conecte um Resultado com peça real gerada pra ver o status aqui.</p>;

  return (
    <div className="space-y-1.5">
      <VariacoesGrid variacoes={resultado.variacoes} missionId={resultado.missionId} />
      <p className="text-[10px] text-areia/40">O menu &quot;⋮ → Aprovar&quot; marca só este node — a aprovação real acontece na missão.</p>
    </div>
  );
}

const CANAIS_ENTREGA = ["Link para download", "Pasta compartilhada", "WhatsApp", "E-mail do briefing", "Outro"];

function CorpoEntrega({ node, patch }: { node: NodeV; patch: (p: Partial<VetorNodeData>) => void }) {
  return (
    <div className="space-y-2">
      <select value={node.data.entregaCanal ?? ""} onChange={(e) => patch({ entregaCanal: e.target.value || undefined })} className={CAMPO}>
        <option value="">Canal de entrega: a definir</option>
        {CANAIS_ENTREGA.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea value={node.data.descricao} onChange={(e) => patch({ descricao: e.target.value })} rows={2} placeholder="Prazo, destinatário, observações..." className={CAMPO} />
    </div>
  );
}
