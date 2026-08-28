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
import { CanvasActionsContext } from "./canvasActions";
import { ICONE_TIPO } from "./nodeIcons";
import CanvasParticleField from "./CanvasParticleField";
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

// Mesmos rótulos de FORMATOS_RESULTADO em VetorFlowNode.tsx — traduz pro
// aspectRatio que o gateway de imagem real entende (ver tamanhoOpenAI em
// apps/agentes/src/integrations/imageProvider.ts). "Outro"/vazio manda
// undefined (o provider usa o padrão dele, nunca inventamos uma proporção).
const MAPA_FORMATO_ASPECT_RATIO: Record<string, string> = {
  Feed: "1:1",
  Story: "9:16",
  Carrossel: "1:1",
  "Capa de Reel": "9:16",
  Anúncio: "16:9",
};

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
  // Achado ao vivo testando geração real: atualizarDadosNode fecha sobre
  // `nodes` da render em que foi criada. O poll do job roda numa closure
  // criada no MESMO tick da atualização "processando" — como o setState
  // ainda não re-renderizou, essa closure via `nodes` direto ficava com a
  // versão ANTIGA do node, e o patch final ("pronto" + resultado) reaplicava
  // um `erro` já resolvido por cima do resultado novo. Ref sempre atual
  // resolve sem precisar reescrever o padrão de histórico (empilharHistorico
  // continua recebendo o array computado, só a LEITURA deixa de ser stale).
  const nodesRef = useRef<NodeV[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [salvandoReceita, setSalvandoReceita] = useState(false);
  const [railExpandido, setRailExpandido] = useState(false);
  const [receitaSalva, setReceitaSalva] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const historicoRef = useRef<GraphJson[]>([{ nodes: graphInicial.nodes, edges: graphInicial.edges }]);
  const indiceRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aplicandoHistoricoRef = useRef(false);

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
    const node = { ...(criarNode(tipo, posicao) as unknown as NodeV), selected: true };
    const novosNodes = [...nodes.map((n) => ({ ...n, selected: false })), node];
    setNodesState(novosNodes);
    empilharHistorico(novosNodes, edges);
  }

  function duplicarNode(id: string) {
    const original = nodes.find((n) => n.id === id);
    if (!original) return;
    const copia = { ...(criarNode(original.data.tipo, { x: original.position.x + 40, y: original.position.y + 40 }) as unknown as NodeV), selected: true };
    copia.data = { ...original.data };
    const novosNodes = [...nodes.map((n) => ({ ...n, selected: false })), copia];
    setNodesState(novosNodes);
    empilharHistorico(novosNodes, edges);
  }

  function removerNode(id: string) {
    const novosNodes = nodes.filter((n) => n.id !== id);
    const novosEdges = edges.filter((e) => e.source !== id && e.target !== id);
    setNodesState(novosNodes);
    setEdgesState(novosEdges);
    empilharHistorico(novosNodes, novosEdges);
  }

  function atualizarDadosNode(id: string, patch: Partial<VetorNodeData>) {
    const novosNodes = nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
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

  // Junta título+configuração de tudo que alimenta o node de Resultado
  // (edges apontando pra ele) num prompt em linguagem natural — mesmo
  // princípio de antes (nunca um parâmetro JSON novo pro provider, só texto
  // descritivo), mas agora escrito como PROMPT de imagem, não como briefing
  // de missão pro Vetor decidir depois.
  function montarPromptDosNodes(resultadoId: string): string {
    const idsOrigem = edges.filter((e) => e.target === resultadoId).map((e) => e.source);
    const nodesOrigem = nodes.filter((n) => idsOrigem.includes(n.id));
    const partes = nodesOrigem
      .filter((n) => n.data.titulo.trim() || n.data.descricao.trim())
      .map((n) => [n.data.titulo, n.data.descricao].filter(Boolean).join(" — "));

    nodesOrigem.forEach((n) => {
      if (n.data.tipo === "arquivo" && n.data.arquivoNome) partes.push(`Use a imagem anexada (${n.data.arquivoNome}) como referência real — nunca invente o que não está nela.`);
      if (n.data.tipo === "referencia" && n.data.referenciaTitulo) partes.push(`Estilo de referência: "${n.data.referenciaTitulo}".`);
      if (n.data.tipo === "brandkit" && n.data.brandkitAssetNomes?.length) partes.push(`Use a identidade visual real: ${n.data.brandkitAssetNomes.join(", ")}.`);
      if (n.data.tipo === "direcao_arte" && n.data.direcaoArteEstilo) partes.push(`Direção de arte: ${n.data.direcaoArteEstilo}.`);
      if (n.data.tipo === "entrega" && n.data.entregaCanal) partes.push(`Formato final pra: ${n.data.entregaCanal}.`);
    });

    const resultado = nodes.find((n) => n.id === resultadoId);
    if (resultado?.data.titulo.trim() || resultado?.data.descricao.trim()) {
      partes.unshift([resultado!.data.titulo, resultado!.data.descricao].filter(Boolean).join(" — "));
    }
    return partes.filter(Boolean).join("\n");
  }

  // arquivo/brandkit apontam pra business_assets reais (nunca uma
  // descrição solta esperando o modelo "desenhar" a foto de memória) — o
  // ImageAdapter baixa esses ativos de verdade e manda como referência
  // real pro gpt-image-1/Nano Banana (ver apps/agentes/src/ai-providers/
  // imageAdapter.ts).
  function coletarReferenceAssetIds(resultadoId: string): string[] {
    const idsOrigem = edges.filter((e) => e.target === resultadoId).map((e) => e.source);
    const nodesOrigem = nodes.filter((n) => idsOrigem.includes(n.id));
    const ids: string[] = [];
    nodesOrigem.forEach((n) => {
      if (n.data.tipo === "arquivo" && n.data.arquivoAssetId) ids.push(n.data.arquivoAssetId);
      if (n.data.tipo === "brandkit" && n.data.brandkitAssetIds?.length) ids.push(...n.data.brandkitAssetIds);
    });
    return Array.from(new Set(ids));
  }

  function coletarProviderPreferido(resultadoId: string): string | undefined {
    const idsOrigem = edges.filter((e) => e.target === resultadoId).map((e) => e.source);
    const nodeProvider = nodes.find((n) => idsOrigem.includes(n.id) && n.data.tipo === "provider" && n.data.providerPreferido);
    return nodeProvider?.data.providerPreferido;
  }

  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  function pararPolling(resultadoId: string) {
    const intervalo = pollingRefs.current.get(resultadoId);
    if (intervalo) {
      clearInterval(intervalo);
      pollingRefs.current.delete(resultadoId);
    }
  }

  useEffect(() => () => pollingRefs.current.forEach((intervalo) => clearInterval(intervalo)), []);

  function pollJob(resultadoId: string, jobId: string) {
    pararPolling(resultadoId);
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-suite/jobs/${jobId}/status`);
        const data = await res.json();
        const job = data.job;
        if (!job) return;
        if (job.status === "done") {
          pararPolling(resultadoId);
          const urls = (job.result_asset_urls as string[]) ?? [];
          atualizarDadosNode(resultadoId, {
            estado: "pronto",
            resultado: {
              thumbnailUrl: urls[0] ?? null,
              aspectRatio: null,
              resolucao: null,
              provider: job.provider_id ?? null,
              custoCentavos: null,
              designProjectId: null,
              missionId: null,
              mock: false,
              variacoes: urls.map((url: string, i: number) => ({ designProjectId: null, thumbnailUrl: url, aspectRatio: null, resolucao: `variação ${i + 1}`, status: "gerada" })),
            },
          });
        } else if (job.status === "failed") {
          pararPolling(resultadoId);
          atualizarDadosNode(resultadoId, { estado: "erro", erro: job.error ?? "Falha na geração." });
        }
      } catch {
        // Silencioso — próximo tick tenta de novo (mesmo padrão do
        // GenerationJobCard da suíte de IA).
      }
    }, 1500);
    pollingRefs.current.set(resultadoId, intervalo);
  }

  // Geração real e direta — sem passar por missão/aprovação (achado ao
  // vivo: o caminho antigo exigia sair do canvas pra aprovar numa outra
  // tela, quebrando o fluxo "clica e vê o resultado" que Freepik/Gravyx
  // têm). Mesmo gateway real de imagem de sempre (OpenAI/Gemini), só que
  // pelo caminho direto da suíte de IA (POST /ai-suite/generate + poll),
  // igual ao /imagem — nunca finge sucesso: erro real do provider aparece
  // no node, nunca uma imagem fictícia.
  async function gerarImagemDireta(resultadoId: string) {
    const prompt = montarPromptDosNodes(resultadoId);
    if (!prompt.trim()) {
      atualizarDadosNode(resultadoId, { estado: "erro", erro: "Conecte ao menos um node com título ou descrição antes de gerar." });
      return;
    }
    const resultadoNode = nodes.find((n) => n.id === resultadoId);
    const referenceAssetIds = coletarReferenceAssetIds(resultadoId);
    const provider = resultadoNode?.data.providerPreferido ?? coletarProviderPreferido(resultadoId);
    const aspectRatio = MAPA_FORMATO_ASPECT_RATIO[resultadoNode?.data.formatoDesejado ?? ""] ?? undefined;

    atualizarDadosNode(resultadoId, { estado: "processando", erro: null });
    try {
      const res = await fetch("/api/ai-suite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          modelId: "auto",
          prompt,
          referenceAssetIds: referenceAssetIds.length > 0 ? referenceAssetIds : undefined,
          aspectRatio,
          quantity: resultadoNode?.data.variacoesDesejadas ?? 1,
          extra: provider ? { provider } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao iniciar a geração");
      pollJob(resultadoId, data.job.id);
    } catch (err) {
      atualizarDadosNode(resultadoId, { estado: "erro", erro: err instanceof Error ? err.message : "Falha ao gerar a imagem" });
    }
  }

  // Design V2 (auditoria Gravyx) — nenhum tipo (scene_graph, critica,
  // aprovacao) tem resultado próprio: todos leem do node "resultado"
  // conectado a eles (em qualquer direção da seta, pra não depender de como
  // o cliente desenhou a conexão). Passado pro NodePropertiesPanel, que
  // decide o que extrair dele por tipo (designProjectId, missionId,
  // variações...).
  function resultadoConectado(nodeId: string): NodeV | null {
    const idsVizinhos = edges.filter((e) => e.source === nodeId || e.target === nodeId).map((e) => (e.source === nodeId ? e.target : e.source));
    return nodes.find((n) => idsVizinhos.includes(n.id) && n.data.tipo === "resultado") ?? null;
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
          <Link href="/design/canvas" className="text-areia/40 hover:text-menta">
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
        <div className="relative flex-1">
          {/* Design V2 (auditoria Gravyx, 2ª rodada) — não existe mais painel
              lateral: cada node é a própria superfície de edição (achado
              central da auditoria — nenhum node do Gravyx abre um painel
              fora dele mesmo). O contexto dá aos nodes acesso aos handlers
              sem prop-drilling através do NodeProps do React Flow. */}
          <CanvasParticleField />
          <CanvasActionsContext.Provider
            value={{
              clienteId,
              supabase,
              onPatch: atualizarDadosNode,
              onDuplicar: duplicarNode,
              onRemover: removerNode,
              onReprocessar: reprocessarNode,
              onGerarPecaReal: gerarImagemDireta,
              resultadoConectado,
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              colorMode="dark"
              fitView
              // Achado ao vivo: o React Flow escuta keydown no document pra
              // atalhos (deletar/selecionar/pan/zoom por teclado) e por
              // padrão intercepta ANTES de checar se o foco está num campo
              // de texto — isso quebra a composição de tecla morta usada
              // pra digitar ç/ã/õ no teclado ABNT. Nunca usamos atalho de
              // teclado no canvas (deletar é sempre pelo menu "⋮" do
              // próprio node), então desligamos os 5 códigos de tecla do
              // React Flow por completo em vez de tentar reconciliar.
              deleteKeyCode={null}
              selectionKeyCode={null}
              multiSelectionKeyCode={null}
              zoomActivationKeyCode={null}
              panActivationKeyCode={null}
            >
              <Background color="var(--color-areia)" gap={28} size={1} style={{ opacity: 0.05 }} />
              {/* bottom-right: o trilho de ícones novo já ocupa a lateral
                  esquerda inteira, evita sobrepor os controles de zoom. */}
              <Controls position="bottom-right" />
              <MiniMap pannable zoomable position="top-right" style={{ background: "var(--color-petroleo-2)" }} />
            </ReactFlow>
          </CanvasActionsContext.Provider>

          {/* Trilho de ícones à esquerda (auditoria Magnific/Freepik) — mesmo
              padrão hover-expand do menu principal (SidebarNav.tsx): em
              repouso só ícones, passar o mouse expande o trilho inteiro e
              revela o rótulo ao lado de cada um — nunca ocupa espaço de
              tela permanente igual a cápsula de texto de antes. */}
          <div className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center">
            <div
              onMouseEnter={() => setRailExpandido(true)}
              onMouseLeave={() => setRailExpandido(false)}
              className={`pointer-events-auto flex max-h-[calc(100%-2rem)] flex-col gap-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-areia/10 bg-petroleo-2/90 p-1.5 shadow-2xl transition-[width] duration-200 ease-out ${
                railExpandido ? "w-44" : "w-11"
              }`}
            >
              {TIPOS_TOOLBAR.map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => adicionarNode(tipo)}
                  title={railExpandido ? undefined : RÓTULO_TIPO[tipo]}
                  className="flex shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg px-1.5 py-2 transition-colors hover:bg-areia/5"
                  style={{ color: COR_TIPO[tipo] }}
                >
                  <span className="size-4 shrink-0">{ICONE_TIPO[tipo]}</span>
                  <span className={`text-xs transition-opacity duration-150 ${railExpandido ? "opacity-100" : "opacity-0"}`}>{RÓTULO_TIPO[tipo]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
