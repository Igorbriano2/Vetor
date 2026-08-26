"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Node } from "@xyflow/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VetorNodeData } from "@/lib/canvas/types";
import { ESTILOS_VISUAIS } from "@/lib/design/receitasAgencia";

type NodeV = Node<VetorNodeData>;

// Design V2 (auditoria node-a-node do Gravyx) — antes disto, TODO tipo de
// node caía no mesmo bloco genérico (Título + "Configuração" texto livre).
// A auditoria mostrou que no Gravyx cada node abre a interface certa pra
// sua função (upload de verdade, seletor de referência, seletor de
// provider...) — este arquivo é o dispatcher por tipo que faz o mesmo aqui,
// sempre em cima de dado real do banco, nunca uma opção fictícia. O
// wrapper (Título, ações genéricas Reprocessar/Duplicar/Remover/Aprovar)
// continua em CreativeCanvasEditor.tsx — aqui é só o corpo que varia.
interface Props {
  node: NodeV;
  clienteId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  onPatch: (patch: Partial<VetorNodeData>) => void;
  onGerarPecaReal: () => void;
  onAtualizarResultadoReal: () => void;
  resultadoConectado: (nodeId: string) => NodeV | null;
}

const CAMPO = "mt-1 w-full rounded-lg border border-areia/15 bg-petroleo px-2.5 py-1.5 text-xs text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none";
const ROTULO = "mono-label text-[10px] text-areia/40";

export default function NodePropertiesPanel(props: Props) {
  switch (props.node.data.tipo) {
    case "briefing":
      return <PainelTexto {...props} label="Briefing do cliente" placeholder="Descreva a demanda como o cliente digitaria no chat..." rows={6} />;
    case "prompt_visual":
      return <PainelTexto {...props} label="Prompt visual" placeholder="Composição, cores, texto na peça, estilo desejado..." rows={6} />;
    case "arquivo":
      return <PainelArquivo {...props} />;
    case "referencia":
      return <PainelReferencia {...props} />;
    case "brandkit":
      return <PainelBrandkit {...props} />;
    case "direcao_arte":
      return <PainelDirecaoArte {...props} />;
    case "provider":
      return <PainelProvider {...props} />;
    case "resultado":
      return <PainelResultado {...props} />;
    case "scene_graph":
      return <PainelSceneGraph {...props} />;
    case "critica":
      return <PainelCritica {...props} />;
    case "aprovacao":
      return <PainelAprovacao {...props} />;
    case "entrega":
      return <PainelEntrega {...props} />;
    default:
      return null;
  }
}

// ————— Bucket A: texto livre genuíno (briefing/prompt_visual) —————

function PainelTexto({ node, onPatch, label, placeholder, rows }: Props & { label: string; placeholder: string; rows: number }) {
  return (
    <label className="block">
      <span className={ROTULO}>{label}</span>
      <textarea
        value={node.data.descricao}
        onChange={(e) => onPatch({ descricao: e.target.value })}
        rows={rows}
        placeholder={placeholder}
        className={CAMPO}
      />
    </label>
  );
}

// ————— arquivo: upload real (mesmo endpoint/fluxo de VetorCockpit.tsx) —————

function PainelArquivo({ node, onPatch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const status = node.data.arquivoStatus ?? "vazio";

  async function enviar(arquivo: File) {
    onPatch({ arquivoStatus: "enviando", arquivoNome: arquivo.name, arquivoMimeType: arquivo.type });
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao enviar o arquivo");
      onPatch({ arquivoStatus: "pronto", arquivoAssetId: data.assetId, arquivoUrl: data.url, arquivoNome: data.nome ?? arquivo.name, arquivoMimeType: data.mimeType ?? arquivo.type });
    } catch (err) {
      onPatch({ arquivoStatus: "erro", erro: err instanceof Error ? err.message : "Falha ao enviar" });
    }
  }

  const ehImagem = node.data.arquivoMimeType?.startsWith("image/");

  return (
    <div className="space-y-2">
      <span className={ROTULO}>Arquivo</span>
      {status === "pronto" && node.data.arquivoUrl ? (
        <div className="overflow-hidden rounded-lg border border-areia/10 bg-petroleo/60">
          {ehImagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.data.arquivoUrl} alt={node.data.arquivoNome ?? "arquivo"} className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-16 items-center justify-center text-[11px] text-areia/50">{node.data.arquivoNome}</div>
          )}
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="truncate text-[10px] text-areia/50">{node.data.arquivoNome}</span>
            <button
              onClick={() => onPatch({ arquivoStatus: "vazio", arquivoAssetId: undefined, arquivoUrl: null, arquivoNome: undefined, arquivoMimeType: undefined })}
              className="shrink-0 text-[10px] text-coral hover:underline"
            >
              trocar
            </button>
          </div>
        </div>
      ) : (
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
          className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center transition ${
            arrastando ? "border-menta/50 bg-menta/5" : "border-areia/20 hover:border-areia/35"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf"
            onChange={(e) => e.target.files?.[0] && void enviar(e.target.files[0])}
          />
          <span className="text-[11px] text-areia/50">
            {status === "enviando" ? "Enviando..." : status === "erro" ? "Falhou — clique pra tentar de novo" : "Arraste ou clique pra enviar"}
          </span>
        </div>
      )}
    </div>
  );
}

// ————— referencia: item real de reference_library_items —————

interface ItemReferencia {
  id: string;
  title: string;
  sourceType: string;
}

function PainelReferencia({ node, clienteId, supabase, onPatch }: Props) {
  const [itens, setItens] = useState<ItemReferencia[] | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase
      .from("reference_library_items")
      .select("id, title, source_type")
      .or(`cliente_id.eq.${clienteId},cliente_id.is.null`)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (vivo) setItens((data ?? []).map((d: { id: string; title: string; source_type: string }) => ({ id: d.id, title: d.title, sourceType: d.source_type })));
      });
    return () => {
      vivo = false;
    };
  }, [supabase, clienteId]);

  return (
    <div className="space-y-2">
      <span className={ROTULO}>Referência da biblioteca</span>
      {itens === null ? (
        <p className="text-[11px] text-areia/30">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-[11px] text-areia/30">Nenhuma referência cadastrada ainda.</p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {itens.map((item) => (
            <button
              key={item.id}
              onClick={() => onPatch({ referenciaItemId: item.id, referenciaTitulo: item.title })}
              className={`block w-full truncate rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                node.data.referenciaItemId === item.id ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/30"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
      <Link href="/referencias" className="inline-block text-[10px] text-menta hover:underline">
        Gerenciar em /referencias →
      </Link>
      <label className="block">
        <span className={ROTULO}>Nota</span>
        <textarea
          value={node.data.descricao}
          onChange={(e) => onPatch({ descricao: e.target.value })}
          rows={2}
          placeholder="Instruções extras, ex: use só a paleta de cores..."
          className={CAMPO}
        />
      </label>
    </div>
  );
}

// ————— brandkit: business_assets categoria=identidade_visual —————
// Não existe tabela brand_kits no schema — isto é um seletor sobre os
// ativos reais de identidade visual do cliente (mesma categoria usada em
// /configuracoes/negocio/banco-de-imagens). Rótulo do produto continua
// "BrandKit" porque é o termo que o cliente reconhece.

interface AssetIdentidade {
  id: string;
  nome: string;
  isLogoPrincipal: boolean;
}

function PainelBrandkit({ node, clienteId, supabase, onPatch }: Props) {
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
    onPatch({ brandkitAssetIds: novosIds, brandkitAssetNomes: jaTem ? novosNomes : [...novosNomes, item.nome] });
  }

  return (
    <div className="space-y-2">
      <span className={ROTULO}>Identidade visual (BrandKit)</span>
      {ativos === null ? (
        <p className="text-[11px] text-areia/30">Carregando...</p>
      ) : ativos.length === 0 ? (
        <p className="text-[11px] text-areia/30">Nenhum ativo de identidade visual cadastrado ainda.</p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {ativos.map((item) => (
            <button
              key={item.id}
              onClick={() => alternar(item)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                selecionados.includes(item.id) ? "border-ambar bg-ambar/10 text-ambar" : "border-areia/15 text-areia/70 hover:border-ambar/30"
              }`}
            >
              <span className="truncate">{item.nome}</span>
              {item.isLogoPrincipal && <span className="mono-label shrink-0 text-[9px] text-areia/40">logo principal</span>}
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

// ————— direcao_arte: mesmos 6 estilos de ESTILOS_VISUAIS —————

function PainelDirecaoArte({ node, onPatch }: Props) {
  return (
    <div className="space-y-2">
      <span className={ROTULO}>Direção de arte</span>
      <div className="grid grid-cols-2 gap-1.5">
        {ESTILOS_VISUAIS.map((e) => (
          <button
            key={e.valor}
            onClick={() => onPatch({ direcaoArteEstilo: e.valor })}
            aria-pressed={node.data.direcaoArteEstilo === e.valor}
            className={`rounded-lg border p-2 text-left transition ${
              node.data.direcaoArteEstilo === e.valor ? "border-electric bg-electric/10" : "border-areia/15 hover:border-electric/30"
            }`}
          >
            <p className={`text-[11px] font-medium ${node.data.direcaoArteEstilo === e.valor ? "text-electric" : "text-areia"}`}>{e.label}</p>
            <p className="mt-0.5 text-[10px] text-areia/40">{e.ajuda}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ————— provider: só os 2 providers reais de imagem —————
// Espelha apps/agentes/src/integrations/imageProvider.ts — adicionar um 3º
// provider exige atualizar os dois arquivos (código server-only não pode
// ser importado aqui).

const PROVEDORES_IMAGEM: Array<{ valor: "openai" | "gemini"; label: string }> = [
  { valor: "openai", label: "OpenAI — gpt-image-1" },
  { valor: "gemini", label: "Google Gemini — Nano Banana" },
];

function PainelProvider({ node, onPatch }: Props) {
  return (
    <label className="block">
      <span className={ROTULO}>Provider de imagem</span>
      <select
        value={node.data.providerPreferido ?? ""}
        onChange={(e) => onPatch({ providerPreferido: (e.target.value || undefined) as "openai" | "gemini" | undefined })}
        className={CAMPO}
      >
        <option value="">Automático (o sistema decide)</option>
        {PROVEDORES_IMAGEM.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ————— resultado / scene_graph: relocados sem mudança de comportamento —————

const FORMATOS_RESULTADO = ["Feed", "Story", "Carrossel", "Capa de Reel", "Anúncio", "Outro"];

function VariacoesGrid({ variacoes, missionId }: { variacoes: NonNullable<NodeV["data"]["resultado"]>["variacoes"]; missionId: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
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
                abrir no editor
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

function PainelResultado({ node, onPatch, onGerarPecaReal, onAtualizarResultadoReal }: Props) {
  return (
    <div className="space-y-2 rounded-lg border border-ambar/20 bg-ambar/5 p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={ROTULO}>Formato</span>
          <select
            value={node.data.formatoDesejado ?? ""}
            onChange={(e) => onPatch({ formatoDesejado: e.target.value || undefined })}
            className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo px-2 py-1 text-xs text-areia focus:border-menta focus:outline-none"
          >
            <option value="">A definir</option>
            {FORMATOS_RESULTADO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO}>Variações</span>
          <input
            type="number"
            min={1}
            max={6}
            value={node.data.variacoesDesejadas ?? 1}
            onChange={(e) => onPatch({ variacoesDesejadas: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
            className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo px-2 py-1 text-xs text-areia focus:border-menta focus:outline-none"
          />
        </label>
      </div>
      <p className="text-[11px] text-areia/50">
        Geração real usa os nodes conectados como briefing e passa pela aprovação normal da missão — nunca gera direto, nunca em lote.
      </p>
      <button
        onClick={onGerarPecaReal}
        disabled={node.data.estado === "processando"}
        className="w-full rounded-lg border border-ambar/40 bg-ambar/10 px-2.5 py-1.5 text-[11px] font-semibold text-ambar hover:bg-ambar/20 disabled:opacity-40"
      >
        {node.data.estado === "processando" ? "Enviando ao Vetor..." : "Gerar peça real"}
      </button>

      {node.data.resultado?.missionId && (
        <div className="flex items-center justify-between gap-2">
          <Link href={`/missoes/${node.data.resultado.missionId}`} className="text-[11px] text-menta hover:underline">
            Ver e aprovar na missão →
          </Link>
          <button onClick={onAtualizarResultadoReal} className="text-[11px] text-areia/50 hover:text-areia">
            Atualizar
          </button>
        </div>
      )}

      {node.data.resultado && !node.data.resultado.mock && node.data.resultado.variacoes.length > 0 ? (
        <VariacoesGrid variacoes={node.data.resultado.variacoes} missionId={node.data.resultado.missionId} />
      ) : node.data.resultado && !node.data.resultado.mock ? (
        <p className="rounded-lg bg-petroleo-3/40 p-2 text-[11px] text-areia/40">
          Aguardando geração — {node.data.estado === "erro" ? "a geração falhou, veja abaixo" : "esperando a etapa de Design da missão ser aprovada e concluída"}.
        </p>
      ) : null}

      {node.data.estado === "erro" && node.data.resultado?.missionId && (
        <Link href={`/missoes/${node.data.resultado.missionId}`} className="text-[11px] text-coral hover:underline">
          Tentar de novo na missão →
        </Link>
      )}
    </div>
  );
}

function PainelSceneGraph({ node, resultadoConectado }: Props) {
  const conectado = resultadoConectado(node.id);
  const designProjectId = conectado?.data.resultado?.designProjectId;
  return (
    <p className="text-[11px] text-areia/40">
      {designProjectId ? (
        <Link href={`/design/editor/${designProjectId}`} className="text-menta hover:underline">
          Abrir Scene Graph real →
        </Link>
      ) : (
        "Disponível depois de conectar um node de Resultado com uma peça real já gerada e aprovada."
      )}
    </p>
  );
}

// ————— critica: design_critic real, já persistido —————

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
  composicaoHierarquia: "Composição/hierarquia",
  contraste: "Contraste",
  legibilidadeMobile: "Legibilidade mobile",
  tipografia: "Tipografia",
  proporcao: "Proporção",
  alinhamento: "Alinhamento",
  respiroVisual: "Respiro visual",
  cta: "CTA",
  usoDaLogo: "Uso da logo",
  aderenciaBrandKit: "Aderência ao BrandKit",
  adequacaoAoCanal: "Adequação ao canal",
  coerenciaComPedido: "Coerência com o pedido",
};

function PainelCritica({ node, supabase, onPatch, resultadoConectado }: Props) {
  const conectado = resultadoConectado(node.id);
  const designProjectId = conectado?.data.resultado?.designProjectId;
  const [critic, setCritic] = useState<DesignCriticResultado | null | "carregando">(null);
  const [ultimoDesignProjectId, setUltimoDesignProjectId] = useState<string | null | undefined>(undefined);

  // Ajusta estado durante o render (mesmo padrão já usado em
  // CalendarioEditorial pro índice de semana) em vez de um setState direto
  // dentro do efeito — reseta quando o node conectado muda.
  if (designProjectId !== ultimoDesignProjectId) {
    setUltimoDesignProjectId(designProjectId);
    setCritic(designProjectId ? "carregando" : null);
  }

  useEffect(() => {
    if (!designProjectId) return;
    let vivo = true;
    supabase
      .from("design_projects")
      .select("design_critic")
      .eq("id", designProjectId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (!vivo) return;
        const resultado = (data?.design_critic as DesignCriticResultado | null) ?? null;
        setCritic(resultado);
        if (resultado) onPatch({ criticaResumo: { passed: resultado.passed, issuesCount: resultado.issues?.length ?? 0 } });
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designProjectId, supabase]);

  if (!designProjectId) {
    return <p className="text-[11px] text-areia/40">Disponível depois de conectar um node de Resultado com uma peça real já gerada.</p>;
  }
  if (critic === "carregando") {
    return <p className="text-[11px] text-areia/30">Carregando avaliação...</p>;
  }
  if (!critic) {
    return <p className="text-[11px] text-areia/30">Esta peça ainda não passou pela avaliação automática do Design Critic.</p>;
  }

  return (
    <div className="space-y-2">
      <div className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${critic.passed ? "border-menta/30 bg-menta/10 text-menta" : "border-coral/30 bg-coral/10 text-coral"}`}>
        {critic.passed ? "Aprovada pelo Design Critic" : "Reprovada pelo Design Critic"} — {critic.resumo}
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
      <label className="block">
        <span className={ROTULO}>Nota adicional</span>
        <textarea
          value={node.data.descricao}
          onChange={(e) => onPatch({ descricao: e.target.value })}
          rows={2}
          placeholder="Comentário seu além da avaliação automática..."
          className={`${CAMPO} rounded-2xl rounded-tr-md border-menta/20 bg-menta/10`}
        />
      </label>
    </div>
  );
}

// ————— aprovacao: status real das variações conectadas —————

function PainelAprovacao({ node, resultadoConectado }: Props) {
  const conectado = resultadoConectado(node.id);
  const resultado = conectado?.data.resultado;

  return (
    <div className="space-y-2">
      {!resultado || resultado.mock ? (
        <p className="text-[11px] text-areia/40">Conecte um node de Resultado com peça real gerada pra ver o status de aprovação aqui.</p>
      ) : (
        <>
          <div className="rounded-2xl border border-areia/10 bg-gradient-to-b from-petroleo-2 to-petroleo p-2">
            <VariacoesGrid variacoes={resultado.variacoes} missionId={resultado.missionId} />
          </div>
          <p className="text-[10px] text-areia/40">
            O botão &quot;Aprovar&quot; abaixo marca só este node do canvas — a aprovação real de cada variação acontece na missão.
          </p>
        </>
      )}
    </div>
  );
}

// ————— entrega: canal desejado (hint, não contrato de backend) —————

const CANAIS_ENTREGA = ["Link para download", "Pasta compartilhada", "WhatsApp", "E-mail do briefing", "Outro"];

function PainelEntrega({ node, onPatch }: Props) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={ROTULO}>Canal de entrega desejado</span>
        <select value={node.data.entregaCanal ?? ""} onChange={(e) => onPatch({ entregaCanal: e.target.value || undefined })} className={CAMPO}>
          <option value="">A definir</option>
          {CANAIS_ENTREGA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={ROTULO}>Detalhes da entrega</span>
        <textarea
          value={node.data.descricao}
          onChange={(e) => onPatch({ descricao: e.target.value })}
          rows={2}
          placeholder="Prazo, destinatário, observações..."
          className={CAMPO}
        />
      </label>
    </div>
  );
}
