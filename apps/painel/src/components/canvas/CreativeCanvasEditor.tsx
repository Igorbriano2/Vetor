"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import VetorFlowNode from "./VetorFlowNode";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { criarNode, RÓTULO_TIPO, COR_TIPO, type GraphJson, type TipoNode, type VetorNodeData } from "@/lib/canvas/types";

const NODE_TYPES = { vetorNode: VetorFlowNode };

const TIPOS_TOOLBAR: TipoNode[] = [
  "briefing",
  "arquivo",
  "referencia",
  "brandkit",
  "prompt_visual",
  "direcao_arte",
  "provider",
  "resultado",
  "scene_graph",
  "critica",
  "aprovacao",
  "entrega",
];

const HISTORICO_MAXIMO = 50;
const DEBOUNCE_AUTOSAVE_MS = 800;

interface Props {
  projectId: string;
  tituloInicial: string;
  graphInicial: GraphJson;
}

type NodeV = Node<VetorNodeData>;

export default function CreativeCanvasEditor({ projectId, tituloInicial, graphInicial }: Props) {
  const [nodes, setNodesState] = useState<NodeV[]>(graphInicial.nodes as unknown as NodeV[]);
  const [edges, setEdgesState] = useState<Edge[]>(graphInicial.edges as unknown as Edge[]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(tituloInicial);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const historicoRef = useRef<GraphJson[]>([{ nodes: graphInicial.nodes, edges: graphInicial.edges }]);
  const indiceRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aplicandoHistoricoRef = useRef(false);

  const nodeSelecionado = nodes.find((n) => n.id === selecionadoId) ?? null;

  const salvar = useCallback(async () => {
    setSalvando(true);
    const graph: GraphJson = { nodes: nodes as unknown as GraphJson["nodes"], edges: edges as unknown as GraphJson["edges"] };
    const { error } = await supabase.from("creative_canvas_projects").update({ graph_json: graph, updated_at: new Date().toISOString() }).eq("id", projectId);
    setSalvando(false);
    if (!error) setUltimoSalvamento(new Date().toLocaleTimeString("pt-BR"));
  }, [nodes, edges, supabase, projectId]);

  // Autosave com debounce — nunca salva a cada pixel de drag, só depois de
  // 800ms sem mudança nova. Undo/redo não dispara autosave duplicado (o
  // estado restaurado já é o que está salvo ou está prestes a salvar de
  // novo, tanto faz).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void salvar();
    }, DEBOUNCE_AUTOSAVE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [salvar]);

  function empilharHistorico(novosNodes: NodeV[], novosEdges: Edge[]) {
    if (aplicandoHistoricoRef.current) return;
    const snapshot: GraphJson = { nodes: novosNodes as unknown as GraphJson["nodes"], edges: novosEdges as unknown as GraphJson["edges"] };
    const base = historicoRef.current.slice(0, indiceRef.current + 1);
    base.push(snapshot);
    historicoRef.current = base.slice(-HISTORICO_MAXIMO);
    indiceRef.current = historicoRef.current.length - 1;
  }

  function desfazer() {
    if (indiceRef.current <= 0) return;
    indiceRef.current -= 1;
    const snap = historicoRef.current[indiceRef.current]!;
    aplicandoHistoricoRef.current = true;
    setNodesState(snap.nodes as unknown as NodeV[]);
    setEdgesState(snap.edges as unknown as Edge[]);
    aplicandoHistoricoRef.current = false;
  }

  function refazer() {
    if (indiceRef.current >= historicoRef.current.length - 1) return;
    indiceRef.current += 1;
    const snap = historicoRef.current[indiceRef.current]!;
    aplicandoHistoricoRef.current = true;
    setNodesState(snap.nodes as unknown as NodeV[]);
    setEdgesState(snap.edges as unknown as Edge[]);
    aplicandoHistoricoRef.current = false;
  }

  const onNodesChange = useCallback((changes: NodeChange<NodeV>[]) => {
    setNodesState((atual) => applyNodeChanges(changes, atual));
  }, []);

  const onNodeDragStop = useCallback(() => {
    empilharHistorico(nodes, edges);
  }, [nodes, edges]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdgesState((atual) => {
      const novo = applyEdgeChanges(changes, atual);
      empilharHistorico(nodes, novo);
      return novo;
    });
  }, [nodes]);

  const onConnect = useCallback((conn: Connection) => {
    setEdgesState((atual) => {
      const novo = addEdge(conn, atual);
      empilharHistorico(nodes, novo);
      return novo;
    });
  }, [nodes]);

  function adicionarNode(tipo: TipoNode) {
    // Cascata determinística (nunca Math.random em código alcançável pelo
    // render — regra react-hooks/purity) baseada na quantidade atual de
    // nodes, suficiente pra novos nodes não nascerem todos empilhados.
    const posicao = { x: 80 + (nodes.length % 5) * 60, y: 80 + Math.floor(nodes.length / 5) * 100 };
    const node = criarNode(tipo, posicao) as unknown as NodeV;
    const novosNodes = [...nodes, node];
    setNodesState(novosNodes);
    setSelecionadoId(node.id);
    empilharHistorico(novosNodes, edges);
  }

  function duplicarNode(id: string) {
    const original = nodes.find((n) => n.id === id);
    if (!original) return;
    const copia = criarNode(original.data.tipo, { x: original.position.x + 40, y: original.position.y + 40 }) as unknown as NodeV;
    copia.data = { ...original.data };
    const novosNodes = [...nodes, copia];
    setNodesState(novosNodes);
    setSelecionadoId(copia.id);
    empilharHistorico(novosNodes, edges);
  }

  function removerNode(id: string) {
    const novosNodes = nodes.filter((n) => n.id !== id);
    const novosEdges = edges.filter((e) => e.source !== id && e.target !== id);
    setNodesState(novosNodes);
    setEdgesState(novosEdges);
    if (selecionadoId === id) setSelecionadoId(null);
    empilharHistorico(novosNodes, novosEdges);
  }

  function atualizarDadosNode(id: string, patch: Partial<VetorNodeData>) {
    const novosNodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setNodesState(novosNodes);
    empilharHistorico(novosNodes, edges);
  }

  // Reprocessar (Fase 3: sempre mock — nenhuma chamada real de provider
  // acontece aqui; a Fase 4 troca esta simulação pela geração real via
  // criar_peca_de_design, mantendo a mesma UI/estado). Nunca gera uma
  // imagem fictícia: o node de resultado fica sem thumbnailUrl mesmo
  // depois de "pronto", só com metadados claramente marcados "(mock)".
  function reprocessarNode(id: string) {
    atualizarDadosNode(id, { estado: "processando", erro: null });
    setTimeout(() => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      if (node.data.tipo === "resultado") {
        atualizarDadosNode(id, {
          estado: "pronto",
          resultado: {
            thumbnailUrl: null,
            aspectRatio: "1:1 (mock)",
            resolucao: "1024×1024 (mock)",
            provider: "mock — nenhum crédito gasto",
            custoCentavos: 0,
            designProjectId: null,
            mock: true,
          },
        });
      } else {
        atualizarDadosNode(id, { estado: "pronto" });
      }
    }, 1100);
  }

  async function salvarTitulo() {
    await supabase.from("creative_canvas_projects").update({ title: titulo }).eq("id", projectId);
  }

  return (
    <div className="flex h-[calc(100vh-2.5rem)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-areia/10 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/criacoes/canvas" className="text-areia/40 hover:text-menta">
            ← canvas
          </Link>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={salvarTitulo}
            className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-areia hover:border-areia/15 focus:border-menta focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="mono-label text-areia/30">{salvando ? "salvando..." : ultimoSalvamento ? `salvo às ${ultimoSalvamento}` : ""}</span>
          <button onClick={desfazer} className="rounded-lg border border-areia/15 px-2.5 py-1 text-xs text-areia/60 hover:text-areia">
            Desfazer
          </button>
          <button onClick={refazer} className="rounded-lg border border-areia/15 px-2.5 py-1 text-xs text-areia/60 hover:text-areia">
            Refazer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-areia/10 px-4 py-2">
        {TIPOS_TOOLBAR.map((tipo) => (
          <button
            key={tipo}
            onClick={() => adicionarNode(tipo)}
            className="rounded-full border px-2.5 py-1 text-[11px] transition hover:opacity-80"
            style={{ borderColor: `color-mix(in oklab, ${COR_TIPO[tipo]} 35%, transparent)`, color: COR_TIPO[tipo] }}
          >
            + {RÓTULO_TIPO[tipo]}
          </button>
        ))}
      </div>

      <div className="relative flex flex-1">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_: React.MouseEvent, node: NodeV) => setSelecionadoId(node.id)}
            onPaneClick={() => setSelecionadoId(null)}
            colorMode="dark"
            fitView
          >
            <Background color="var(--color-areia)" gap={28} size={1} style={{ opacity: 0.06 }} />
            <Controls />
            <MiniMap pannable zoomable style={{ background: "var(--color-petroleo-2)" }} />
          </ReactFlow>
        </div>

        {nodeSelecionado && (
          <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-l border-areia/10 bg-petroleo-2/60 p-4">
            <p className="mono-label" style={{ color: COR_TIPO[nodeSelecionado.data.tipo] }}>
              {RÓTULO_TIPO[nodeSelecionado.data.tipo]}
            </p>
            <label className="block">
              <span className="mono-label text-areia/40">Título</span>
              <input
                value={nodeSelecionado.data.titulo}
                onChange={(e) => atualizarDadosNode(nodeSelecionado.id, { titulo: e.target.value })}
                className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo px-2.5 py-1.5 text-sm text-areia focus:border-menta focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mono-label text-areia/40">Configuração</span>
              <textarea
                value={nodeSelecionado.data.descricao}
                onChange={(e) => atualizarDadosNode(nodeSelecionado.id, { descricao: e.target.value })}
                rows={4}
                placeholder="Texto livre — briefing, prompt, notas..."
                className="mt-1 w-full rounded-lg border border-areia/15 bg-petroleo px-2.5 py-1.5 text-xs text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
              />
            </label>

            {nodeSelecionado.data.tipo === "scene_graph" && (
              <p className="text-[11px] text-areia/40">
                {nodeSelecionado.data.resultado?.designProjectId
                  ? "Projeto real disponível."
                  : "Disponível depois de gerar um resultado real (Fase 4) — ainda não há Scene Graph real conectado."}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-areia/10 pt-3">
              <button
                onClick={() => reprocessarNode(nodeSelecionado.id)}
                disabled={nodeSelecionado.data.estado === "processando"}
                className="rounded-lg border border-menta/30 px-2.5 py-1.5 text-[11px] text-menta hover:bg-menta/10 disabled:opacity-40"
              >
                {nodeSelecionado.data.estado === "processando" ? "Processando..." : "Reprocessar"}
              </button>
              <button onClick={() => duplicarNode(nodeSelecionado.id)} className="rounded-lg border border-areia/15 px-2.5 py-1.5 text-[11px] text-areia/70 hover:text-areia">
                Duplicar
              </button>
              <button onClick={() => removerNode(nodeSelecionado.id)} className="rounded-lg border border-coral/30 px-2.5 py-1.5 text-[11px] text-coral hover:bg-coral/10">
                Remover
              </button>
              {nodeSelecionado.data.tipo === "aprovacao" && (
                <button
                  onClick={() => atualizarDadosNode(nodeSelecionado.id, { estado: "aprovado" })}
                  className="rounded-lg border border-ambar/30 px-2.5 py-1.5 text-[11px] text-ambar hover:bg-ambar/10"
                >
                  Aprovar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
