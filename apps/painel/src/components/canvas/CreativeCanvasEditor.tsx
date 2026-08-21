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
import { ICONE_TIPO } from "./nodeIcons";
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
  clienteId: string;
  tituloInicial: string;
  graphInicial: GraphJson;
}

type NodeV = Node<VetorNodeData>;

export default function CreativeCanvasEditor({ projectId, clienteId, tituloInicial, graphInicial }: Props) {
  const [nodes, setNodesState] = useState<NodeV[]>(graphInicial.nodes as unknown as NodeV[]);
  const [edges, setEdgesState] = useState<Edge[]>(graphInicial.edges as unknown as Edge[]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [salvandoReceita, setSalvandoReceita] = useState(false);
  const [receitaSalva, setReceitaSalva] = useState(false);

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
            missionId: null,
            mock: true,
            variacoes: [],
          },
        });
      } else {
        atualizarDadosNode(id, { estado: "pronto" });
      }
    }, 1100);
  }

  // Fase 4 do VETOR Manager V2 — junta título+configuração de tudo que
  // alimenta o node de Resultado (edges apontando pra ele) num briefing em
  // linguagem natural, exatamente como um cliente digitaria no chat.
  // Nunca chama criar_peca_de_design direto: passa pela MESMA jornada
  // texto -> proposta -> confirmação -> aprovação manual que o chat já usa
  // (Mission Orchestrator + Policy Engine intocados, aprovação sempre
  // exigida antes de qualquer chamada paga).
  function montarBriefingDosNodes(resultadoId: string): string {
    const idsOrigem = edges.filter((e) => e.target === resultadoId).map((e) => e.source);
    const nodesOrigem = nodes.filter((n) => idsOrigem.includes(n.id));
    const partes = nodesOrigem
      .filter((n) => n.data.titulo.trim() || n.data.descricao.trim())
      .map((n) => `${RÓTULO_TIPO[n.data.tipo]}: ${[n.data.titulo, n.data.descricao].filter(Boolean).join(" — ")}`);
    const resultado = nodes.find((n) => n.id === resultadoId);
    if (resultado?.data.titulo.trim() || resultado?.data.descricao.trim()) {
      partes.unshift([resultado!.data.titulo, resultado!.data.descricao].filter(Boolean).join(" — "));
    }
    return partes.length > 0 ? `Crie uma peça de design a partir deste briefing do Creative Canvas:\n${partes.join("\n")}` : "";
  }

  async function gerarPecaReal(resultadoId: string) {
    const briefing = montarBriefingDosNodes(resultadoId);
    if (!briefing) {
      atualizarDadosNode(resultadoId, { estado: "erro", erro: "Conecte ao menos um node com título ou configuração antes de gerar." });
      return;
    }
    atualizarDadosNode(resultadoId, { estado: "processando", erro: null });
    try {
      const resComando = await fetch("/api/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: briefing, responder_em_voz: false }),
      });
      const dataComando = await resComando.json();
      if (!resComando.ok) throw new Error(dataComando?.error ?? "Falha ao falar com o Vetor");

      if (!dataComando.intent) {
        atualizarDadosNode(resultadoId, {
          estado: "erro",
          erro: `O Vetor precisa de mais contexto: "${dataComando.respostaTexto}" — ajuste os nodes conectados e tente de novo.`,
        });
        return;
      }

      const resMissao = await fetch("/api/missoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: dataComando.intent, solicitacao_id: dataComando.solicitacaoId }),
      });
      const dataMissao = await resMissao.json();
      if (!resMissao.ok) throw new Error(dataMissao?.error ?? "Falha ao confirmar a missão");

      atualizarDadosNode(resultadoId, {
        estado: "aguardando_aprovacao",
        resultado: {
          thumbnailUrl: null,
          aspectRatio: null,
          resolucao: null,
          provider: null,
          custoCentavos: null,
          designProjectId: null,
          missionId: dataMissao.missionId,
          mock: false,
          variacoes: [],
        },
      });
    } catch (err) {
      atualizarDadosNode(resultadoId, { estado: "erro", erro: err instanceof Error ? err.message : "Falha ao gerar a peça real" });
    }
  }

  // Busca o design_project real vinculado à missão (só existe depois que
  // alguém aprovar a etapa de Design na tela da missão — nunca chamado
  // automaticamente por polling, sempre um clique explícito do cliente).
  async function atualizarResultadoReal(resultadoId: string) {
    const node = nodes.find((n) => n.id === resultadoId);
    const missionId = node?.data.resultado?.missionId;
    if (!missionId) return;

    // Design V2 Fase 3 — busca TODOS os design_projects da missão, não só
    // o mais recente: uma missão pode ter mais de uma variação real (o
    // cliente pediu mais de uma opção no texto do briefing).
    const { data: projetos } = await supabase
      .from("design_projects")
      .select("id, status, width, height, thumbnail_url")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: false });

    if (!projetos || projetos.length === 0) return;

    const { data: custos } = await supabase.from("agent_runs").select("custo_estimado_centavos").eq("mission_id", missionId);
    const custoTotal = (custos ?? []).reduce((soma, c) => soma + (c.custo_estimado_centavos as number | null ?? 0), 0);

    const variacoes = projetos.map((p) => ({
      designProjectId: p.id as string,
      thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
      aspectRatio: p.width && p.height ? `${p.width}:${p.height}` : null,
      resolucao: p.width && p.height ? `${p.width}×${p.height}` : null,
      status: p.status as string,
    }));
    const principal = projetos[0];

    atualizarDadosNode(resultadoId, {
      estado: variacoes.every((v) => v.status === "approved") ? "aprovado" : "pronto",
      resultado: {
        thumbnailUrl: (principal.thumbnail_url as string | null) ?? null,
        aspectRatio: principal.width && principal.height ? `${principal.width}:${principal.height}` : null,
        resolucao: principal.width && principal.height ? `${principal.width}×${principal.height}` : null,
        provider: null,
        custoCentavos: custoTotal,
        designProjectId: principal.id as string,
        missionId,
        mock: false,
        variacoes,
      },
    });
  }

  // Node "scene_graph" não tem resultado próprio — o Scene Graph real é
  // sempre o de um node "resultado" conectado a ele (em qualquer direção
  // da seta, pra não depender de como o cliente desenhou a conexão).
  function designProjectConectado(sceneGraphId: string): string | null {
    const idsVizinhos = edges.filter((e) => e.source === sceneGraphId || e.target === sceneGraphId).map((e) => (e.source === sceneGraphId ? e.target : e.source));
    const resultado = nodes.find((n) => idsVizinhos.includes(n.id) && n.data.tipo === "resultado" && n.data.resultado?.designProjectId);
    return resultado?.data.resultado?.designProjectId ?? null;
  }

  async function salvarTitulo() {
    await supabase.from("creative_canvas_projects").update({ title: titulo }).eq("id", projectId);
  }

  // Design V2 (auditoria Gravyx) — Gravyx deixa qualquer projeto de canvas
  // virar um "template" reutilizável com um clique; o Vetor já tinha o
  // equivalente pro cliente (design_flows, usado em /templates), mas só era
  // alimentado pelo formulário manual — nunca a partir de um canvas
  // desenhado de verdade. Reaproveita a tabela e o fluxo já existentes
  // (nenhuma tabela nova, nenhum caminho de geração paralelo): salva o
  // resumo dos nodes como `tarefa_template` em texto natural — quando
  // aplicado depois em /templates, cai no mesmo caminho de sempre
  // (prefill no chat), nunca recria o grafo.
  function montarResumoDoCanvas(): string {
    const partes = nodes
      .filter((n) => n.data.titulo.trim() || n.data.descricao.trim())
      .map((n) => `${RÓTULO_TIPO[n.data.tipo]}: ${[n.data.titulo, n.data.descricao].filter(Boolean).join(" — ")}`);
    return partes.length > 0 ? `Fluxo criado no Creative Canvas "${titulo}":\n${partes.join("\n")}` : "";
  }

  async function salvarComoReceita() {
    const tarefaTemplate = montarResumoDoCanvas();
    if (!tarefaTemplate) return;
    setSalvandoReceita(true);
    const { error } = await supabase.from("design_flows").insert({
      cliente_id: clienteId,
      nome: titulo,
      descricao: "Receita salva a partir de um fluxo do Creative Canvas.",
      department: "design",
      tarefa_template: tarefaTemplate,
      tags: ["creative-canvas"],
    });
    setSalvandoReceita(false);
    if (!error) {
      setReceitaSalva(true);
      setTimeout(() => setReceitaSalva(false), 3000);
    }
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
          <button
            onClick={salvarComoReceita}
            disabled={salvandoReceita || nodes.length === 0}
            className="rounded-lg border border-menta/30 px-2.5 py-1 text-xs text-menta hover:bg-menta/10 disabled:opacity-40"
          >
            {receitaSalva ? "Receita salva ✓" : salvandoReceita ? "Salvando..." : "Salvar como receita"}
          </button>
        </div>
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

          {/* Design V2 (auditoria Gravyx) — barra flutuante de adicionar node,
              posição e formato de cápsula inspirados no toolbar deles, mas com
              rótulo de texto (não só ícone): os 12 tipos do Vetor são
              conceitos específicos do pipeline de criação, não genéricos
              como os deles — ícone sozinho ficaria ambíguo aqui. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-areia/10 bg-petroleo-2/90 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
              {TIPOS_TOOLBAR.map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => adicionarNode(tipo)}
                  title={`Adicionar ${RÓTULO_TIPO[tipo]}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] transition hover:bg-areia/5"
                  style={{ color: COR_TIPO[tipo] }}
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `color-mix(in oklab, ${COR_TIPO[tipo]} 18%, transparent)` }}
                  >
                    <span className="size-3">{ICONE_TIPO[tipo]}</span>
                  </span>
                  <span className="hidden sm:inline">{RÓTULO_TIPO[tipo]}</span>
                </button>
              ))}
            </div>
          </div>
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
                {designProjectConectado(nodeSelecionado.id) ? (
                  <Link href={`/design/editor/${designProjectConectado(nodeSelecionado.id)}`} className="text-menta hover:underline">
                    Abrir Scene Graph real →
                  </Link>
                ) : (
                  "Disponível depois de conectar um node de Resultado com uma peça real já gerada e aprovada."
                )}
              </p>
            )}

            {nodeSelecionado.data.tipo === "resultado" && (
              <div className="space-y-2 rounded-lg border border-ambar/20 bg-ambar/5 p-2.5">
                <p className="text-[11px] text-areia/50">
                  Geração real usa os nodes conectados como briefing e passa pela aprovação normal da missão — nunca
                  gera direto, nunca em lote.
                </p>
                <button
                  onClick={() => gerarPecaReal(nodeSelecionado.id)}
                  disabled={nodeSelecionado.data.estado === "processando"}
                  className="w-full rounded-lg border border-ambar/40 bg-ambar/10 px-2.5 py-1.5 text-[11px] font-semibold text-ambar hover:bg-ambar/20 disabled:opacity-40"
                >
                  {nodeSelecionado.data.estado === "processando" ? "Enviando ao Vetor..." : "Gerar peça real"}
                </button>

                {nodeSelecionado.data.resultado?.missionId && (
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/missoes/${nodeSelecionado.data.resultado.missionId}`} className="text-[11px] text-menta hover:underline">
                      Ver e aprovar na missão →
                    </Link>
                    <button onClick={() => atualizarResultadoReal(nodeSelecionado.id)} className="text-[11px] text-areia/50 hover:text-areia">
                      Atualizar
                    </button>
                  </div>
                )}

                {/* Design V2 Fase 3 — grid de saídas reais (uma missão pode ter
                    N variações). Nunca mostra card vazio como se fosse uma
                    saída pronta: "Aguardando geração" explica o motivo real. */}
                {nodeSelecionado.data.resultado && !nodeSelecionado.data.resultado.mock && nodeSelecionado.data.resultado.variacoes.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {nodeSelecionado.data.resultado.variacoes.map((v, i) => (
                      <div key={v.designProjectId} className="overflow-hidden rounded-lg border border-areia/10 bg-petroleo/60">
                        <div className="flex aspect-square items-center justify-center bg-petroleo overflow-hidden">
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
                          <p className={`text-[10px] ${v.status === "approved" ? "text-menta" : "text-areia/50"}`}>
                            {v.status === "approved" ? "aprovado" : v.status}
                          </p>
                          <div className="flex items-center justify-between pt-0.5">
                            <Link href={`/design/editor/${v.designProjectId}`} className="text-[10px] text-menta hover:underline">
                              abrir no editor
                            </Link>
                            {v.status !== "approved" && (
                              <Link href={`/missoes/${nodeSelecionado.data.resultado?.missionId}`} className="text-[10px] text-ambar hover:underline">
                                aprovar
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : nodeSelecionado.data.resultado && !nodeSelecionado.data.resultado.mock ? (
                  <p className="rounded-lg bg-petroleo-3/40 p-2 text-[11px] text-areia/40">
                    Aguardando geração — {nodeSelecionado.data.estado === "erro" ? "a geração falhou, veja abaixo" : "esperando a etapa de Design da missão ser aprovada e concluída"}.
                  </p>
                ) : null}

                {nodeSelecionado.data.estado === "erro" && nodeSelecionado.data.resultado?.missionId && (
                  <Link href={`/missoes/${nodeSelecionado.data.resultado.missionId}`} className="text-[11px] text-coral hover:underline">
                    Tentar de novo na missão →
                  </Link>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-areia/10 pt-3">
              <button
                onClick={() => reprocessarNode(nodeSelecionado.id)}
                disabled={nodeSelecionado.data.estado === "processando"}
                className="rounded-lg border border-menta/30 px-2.5 py-1.5 text-[11px] text-menta hover:bg-menta/10 disabled:opacity-40"
              >
                {nodeSelecionado.data.estado === "processando" ? "Processando..." : "Reprocessar (mock)"}
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
