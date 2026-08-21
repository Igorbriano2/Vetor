"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface PerfilEstiloVideo {
  pacing: string;
  hookStructure: string;
  colorProfile: string;
  compositionNotes: string;
  cutDensityPerMinute: number;
  musicEnergy: string;
  resumoSimples: string | null;
}

interface PerfilVisualImagem {
  composicao: string;
  grid: string;
  hierarquia: string;
  paleta: string;
  ritmoVisual: string;
  densidade: string;
  tipografiaDescricao: string;
  tratamentoImagem: string;
  resumoSimples: string | null;
}

interface ItemReferencia {
  id: string;
  clienteId: string | null;
  sourceType: "upload" | "external_url" | "curated";
  assetId: string | null;
  externalUrl: string | null;
  title: string;
  description: string | null;
  tags: string[];
  department: string | null;
  direitosUso: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
  isVideo: boolean;
  isImage: boolean;
  perfilEstilo: PerfilEstiloVideo | null;
  perfilVisual: PerfilVisualImagem | null;
}

interface Colecao {
  id: string;
  nome: string;
  descricao: string | null;
}

interface ItemDeColecao {
  collectionId: string;
  itemId: string;
}

interface AssetDrive {
  id: string;
  nome: string;
  mimeType: string | null;
}

const DEPARTAMENTOS = [
  { valor: "design", label: "Design" },
  { valor: "videomaker", label: "Videomaker" },
  { valor: "trafego", label: "Tráfego" },
  { valor: "planejamento", label: "Planejamento" },
  { valor: "conteudo", label: "Conteúdo" },
] as const;

const ORIGEM_LABEL: Record<ItemReferencia["sourceType"], string> = {
  upload: "Do Drive",
  external_url: "Link",
  curated: "Curada Vetor",
};

// Fase 2 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — "Biblioteca
// curada do Vetor" hoje não tem nenhum asset visual real cadastrado (0
// linhas curadas em produção — ver docs/PRODUCT-RESET-AUDIT.md seção 1).
// Em vez de inventar imagens ou preencher a tela com cards vazios, cada
// categoria vira um tile de composição própria do Vetor (gradiente +
// nome) — honesto sobre não ser uma peça real, e ainda assim útil como
// ponto de partida por intenção. Quando existir conteúdo curado real na
// tabela (cliente_id nulo), ele aparece junto, como card de verdade.
const CATEGORIAS_CURADAS = [
  { nome: "Post editorial", descricao: "Comunicados, novidades e conteúdo informativo do dia a dia.", cor: "from-menta/30 to-petroleo" },
  { nome: "Oferta", descricao: "Promoções, descontos e combos com urgência.", cor: "from-ambar/30 to-petroleo" },
  { nome: "Produto", descricao: "Destaque de um item específico do catálogo.", cor: "from-coral/25 to-petroleo" },
  { nome: "Serviço", descricao: "Comunicação de um serviço prestado, não um produto físico.", cor: "from-menta/20 to-petroleo-2" },
  { nome: "Depoimento", descricao: "Prova social — cliente real falando da experiência.", cor: "from-ambar/20 to-petroleo-2" },
  { nome: "Carrossel", descricao: "Sequência de cards contando uma história em várias telas.", cor: "from-coral/20 to-petroleo-2" },
  { nome: "Story", descricao: "Formato vertical rápido, consumo em segundos.", cor: "from-menta/25 to-petroleo" },
  { nome: "Capa de Reel", descricao: "Primeira impressão de um vídeo curto.", cor: "from-ambar/25 to-petroleo" },
  { nome: "Identidade visual", descricao: "Peças que reforçam marca — cores, tipografia, logo.", cor: "from-coral/25 to-petroleo-2" },
  { nome: "Anúncio", descricao: "Peça pensada pra tráfego pago, com CTA direto.", cor: "from-menta/30 to-petroleo-2" },
] as const;

const BUSCAS_PRONTAS = [
  { label: "Quero uma arte elegante", termo: "elegante" },
  { label: "Quero uma promoção forte", termo: "promoção" },
  { label: "Quero uma peça premium", termo: "premium" },
  { label: "Quero algo divertido", termo: "divertido" },
  { label: "Quero um Reel dinâmico", termo: "reel" },
] as const;

export default function ReferenciasPainel({
  clienteId,
  itensIniciais,
  colecoesIniciais,
  itensPorColecaoIniciais,
  assetsDrive,
}: {
  clienteId: string;
  itensIniciais: ItemReferencia[];
  colecoesIniciais: Colecao[];
  itensPorColecaoIniciais: ItemDeColecao[];
  assetsDrive: AssetDrive[];
}) {
  const [itens, setItens] = useState(itensIniciais);
  const [colecoes, setColecoes] = useState(colecoesIniciais);
  const [itensPorColecao, setItensPorColecao] = useState(itensPorColecaoIniciais);
  const [busca, setBusca] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>("todos");
  const [colecaoFiltro, setColecaoFiltro] = useState<string>("todas");
  const [enviando, setEnviando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const itensCurados = itens.filter((i) => i.clienteId === null);
  const meusItens = itens.filter((i) => i.clienteId === clienteId);

  const idsDaColecaoFiltro = useMemo(() => {
    if (colecaoFiltro === "todas") return null;
    return new Set(itensPorColecao.filter((r) => r.collectionId === colecaoFiltro).map((r) => r.itemId));
  }, [itensPorColecao, colecaoFiltro]);

  const filtrados = useMemo(() => {
    return meusItens.filter((i) => {
      if (departamentoFiltro !== "todos" && i.department !== departamentoFiltro) return false;
      if (idsDaColecaoFiltro && !idsDaColecaoFiltro.has(i.id)) return false;
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase();
      return (
        i.title.toLowerCase().includes(termo) ||
        i.description?.toLowerCase().includes(termo) ||
        i.tags.some((t) => t.toLowerCase().includes(termo))
      );
    });
  }, [meusItens, busca, departamentoFiltro, idsDaColecaoFiltro]);

  async function adicionarPorUrl(dados: {
    title: string;
    url: string;
    tagsTexto: string;
    department: string;
    direitosUso: string;
    description: string;
  }) {
    setEnviando(true);
    setErro(null);
    try {
      const tags = dados.tagsTexto.split(",").map((t) => t.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from("reference_library_items")
        .insert({
          cliente_id: clienteId,
          source_type: "external_url",
          external_url: dados.url,
          title: dados.title,
          description: dados.description || null,
          tags,
          department: dados.department || null,
          direitos_uso: dados.direitosUso || null,
        })
        .select("id, cliente_id, source_type, asset_id, external_url, title, description, tags, department, direitos_uso, created_at")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Falha ao salvar a referência.");

      setItens((atual) => [mapearLinha(data), ...atual]);
      setMostrarForm(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui salvar a referência agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function adicionarDoDrive(dados: {
    assetId: string;
    title: string;
    tagsTexto: string;
    department: string;
    direitosUso: string;
    description: string;
  }) {
    setEnviando(true);
    setErro(null);
    try {
      const tags = dados.tagsTexto.split(",").map((t) => t.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from("reference_library_items")
        .insert({
          cliente_id: clienteId,
          source_type: "upload",
          asset_id: dados.assetId,
          title: dados.title,
          description: dados.description || null,
          tags,
          department: dados.department || null,
          direitos_uso: dados.direitosUso || null,
        })
        .select("id, cliente_id, source_type, asset_id, external_url, title, description, tags, department, direitos_uso, created_at")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Falha ao salvar a referência.");

      // Assina a url do asset escolhido só pra atualizar a miniatura na hora
      // — a próxima carga da página já vem com a url assinada pelo server.
      const { data: assetRow } = await supabase.from("business_assets").select("storage_path").eq("id", dados.assetId).maybeSingle();
      let thumbnailUrl: string | null = null;
      if (assetRow?.storage_path) {
        const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(assetRow.storage_path as string, 60 * 60);
        thumbnailUrl = signed?.signedUrl ?? null;
      }
      const mimeType = assetsDrive.find((a) => a.id === dados.assetId)?.mimeType ?? null;
      const isVideo = mimeType?.startsWith("video/") ?? false;
      const isImage = mimeType?.startsWith("image/") ?? false;

      setItens((atual) => [{ ...mapearLinha(data), thumbnailUrl, isVideo, isImage }, ...atual]);
      setMostrarForm(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui salvar a referência agora.");
    } finally {
      setEnviando(false);
    }
  }

  const [analisando, setAnalisando] = useState<Set<string>>(new Set());

  // Fase 3 do Gravyx (Rodada C) — vídeo; Fase 2 do reset de produto —
  // generalizado pra imagem também. Nunca inventa o perfil no client, quem
  // analisa de verdade é sempre o backend (ffmpeg/vision ou só vision).
  async function analisarEstilo(item: ItemReferencia) {
    setAnalisando((atual) => new Set(atual).add(item.id));
    setErro(null);
    try {
      const caminho = item.isVideo ? "analisar" : "analisar-imagem";
      const res = await fetch(`/api/referencias/${item.id}/${caminho}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao analisar essa referência.");

      const p = data.perfil;
      setItens((atual) =>
        atual.map((i) => {
          if (i.id !== item.id) return i;
          if (item.isVideo) {
            return {
              ...i,
              perfilEstilo: {
                pacing: p.pacing,
                hookStructure: p.hookStructure,
                colorProfile: p.colorProfile,
                compositionNotes: p.compositionNotes,
                cutDensityPerMinute: p.cutDensityPerMinute,
                musicEnergy: p.musicEnergy,
                resumoSimples: p.resumoSimples ?? null,
              },
            };
          }
          return {
            ...i,
            perfilVisual: {
              composicao: p.composicao,
              grid: p.grid,
              hierarquia: p.hierarquia,
              paleta: p.paleta,
              ritmoVisual: p.ritmoVisual,
              densidade: p.densidade,
              tipografiaDescricao: p.tipografiaDescricao,
              tratamentoImagem: p.tratamentoImagem,
              resumoSimples: p.resumoSimples ?? null,
            },
          };
        }),
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui analisar essa referência agora.");
    } finally {
      setAnalisando((atual) => {
        const novo = new Set(atual);
        novo.delete(item.id);
        return novo;
      });
    }
  }

  async function arquivar(id: string) {
    const { error } = await supabase
      .from("reference_library_items")
      .update({ status: "arquivado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cliente_id", clienteId);
    if (error) {
      setErro(error.message);
      return;
    }
    setItens((atual) => atual.filter((i) => i.id !== id));
  }

  async function criarColecao(nome: string) {
    if (!nome.trim()) return;
    const { data, error } = await supabase
      .from("reference_collections")
      .insert({ cliente_id: clienteId, nome: nome.trim() })
      .select("id, nome, descricao")
      .single();
    if (error || !data) {
      setErro(error?.message ?? "Falha ao criar coleção.");
      return;
    }
    setColecoes((atual) => [{ id: data.id as string, nome: data.nome as string, descricao: data.descricao as string | null }, ...atual]);
  }

  async function adicionarNaColecao(itemId: string, collectionId: string) {
    if (!collectionId) return;
    const { error } = await supabase
      .from("reference_collection_items")
      .insert({ collection_id: collectionId, reference_library_item_id: itemId, cliente_id: clienteId });
    // Conflito de unique (já está na coleção) não é erro real pra quem usa.
    if (error && error.code !== "23505") {
      setErro(error.message);
      return;
    }
    setItensPorColecao((atual) =>
      atual.some((r) => r.collectionId === collectionId && r.itemId === itemId)
        ? atual
        : [...atual, { collectionId, itemId }],
    );
  }

  return (
    <div className="mt-8 space-y-10">
      <div className="flex flex-wrap gap-2">
        {BUSCAS_PRONTAS.map((b) => (
          <button
            key={b.termo}
            onClick={() => setBusca((atual) => (atual === b.termo ? "" : b.termo))}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              busca === b.termo ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/40"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {erro && <p className="text-xs text-coral">{erro}</p>}

      <section>
        <p className="mono-label mb-3 text-areia/50">Biblioteca curada do Vetor</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIAS_CURADAS.map((c) => (
            <div key={c.nome} className="overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/60">
              <div className={`flex aspect-video items-center justify-center bg-gradient-to-br ${c.cor} p-3 text-center`}>
                <span className="text-sm font-semibold text-areia">{c.nome}</span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-[11px] text-areia/50">{c.descricao}</p>
                <Link
                  href={`/design?categoria=${encodeURIComponent(c.nome)}`}
                  className="mono-label mt-2 block text-center text-menta hover:underline"
                >
                  Usar como inspiração
                </Link>
              </div>
            </div>
          ))}
          {itensCurados.map((item) => (
            <ReferenciaCard
              key={item.id}
              item={item}
              clienteId={clienteId}
              colecoes={colecoes}
              analisando={analisando.has(item.id)}
              onArquivar={arquivar}
              onAdicionarNaColecao={adicionarNaColecao}
              onAnalisarEstilo={analisarEstilo}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <p className="mono-label text-areia/50">Minhas referências</p>
          <button onClick={() => setMostrarForm((v) => !v)} className="mono-label text-menta hover:underline">
            {mostrarForm ? "cancelar" : "+ adicionar referência"}
          </button>
        </div>

        {mostrarForm && (
          <div className="mt-3">
            <AdicionarReferenciaForm enviando={enviando} assetsDrive={assetsDrive} onAdicionarUrl={adicionarPorUrl} onAdicionarDrive={adicionarDoDrive} />
          </div>
        )}

        <div className="mt-4">
          <ColecoesPainel colecoes={colecoes} onCriar={criarColecao} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, descrição ou tag..."
            className="flex-1 rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-2 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
          />
          <select
            value={departamentoFiltro}
            onChange={(e) => setDepartamentoFiltro(e.target.value)}
            className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
          >
            <option value="todos">Todos os departamentos</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={colecaoFiltro}
            onChange={(e) => setColecaoFiltro(e.target.value)}
            className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
          >
            <option value="todas">Todas as coleções</option>
            {colecoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.length === 0 && (
            <p className="col-span-full rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Nenhuma referência sua ainda — adicione uma acima.
            </p>
          )}
          {filtrados.map((item) => (
            <ReferenciaCard
              key={item.id}
              item={item}
              clienteId={clienteId}
              colecoes={colecoes}
              analisando={analisando.has(item.id)}
              onArquivar={arquivar}
              onAdicionarNaColecao={adicionarNaColecao}
              onAnalisarEstilo={analisarEstilo}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function mapearLinha(row: Record<string, unknown>): ItemReferencia {
  return {
    id: row.id as string,
    clienteId: row.cliente_id as string | null,
    sourceType: row.source_type as ItemReferencia["sourceType"],
    assetId: row.asset_id as string | null,
    externalUrl: row.external_url as string | null,
    title: row.title as string,
    description: row.description as string | null,
    tags: (row.tags as string[]) ?? [],
    department: row.department as string | null,
    direitosUso: row.direitos_uso as string | null,
    createdAt: row.created_at as string,
    thumbnailUrl: null,
    isVideo: false,
    isImage: false,
    perfilEstilo: null,
    perfilVisual: null,
  };
}

function AdicionarReferenciaForm({
  enviando,
  assetsDrive,
  onAdicionarUrl,
  onAdicionarDrive,
}: {
  enviando: boolean;
  assetsDrive: AssetDrive[];
  onAdicionarUrl: (dados: { title: string; url: string; tagsTexto: string; department: string; direitosUso: string; description: string }) => void;
  onAdicionarDrive: (dados: { assetId: string; title: string; tagsTexto: string; department: string; direitosUso: string; description: string }) => void;
}) {
  const [origem, setOrigem] = useState<"external_url" | "upload">("external_url");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [description, setDescription] = useState("");
  const [tagsTexto, setTagsTexto] = useState("");
  const [department, setDepartment] = useState("");
  const [direitosUso, setDireitosUso] = useState("");

  function limpar() {
    setTitle("");
    setUrl("");
    setAssetId("");
    setDescription("");
    setTagsTexto("");
    setDepartment("");
    setDireitosUso("");
  }

  function enviar() {
    if (!title.trim()) return;
    if (origem === "external_url") {
      if (!url.trim()) return;
      onAdicionarUrl({ title: title.trim(), url: url.trim(), tagsTexto, department, direitosUso, description });
    } else {
      if (!assetId) return;
      onAdicionarDrive({ assetId, title: title.trim(), tagsTexto, department, direitosUso, description });
    }
    limpar();
  }

  return (
    <div className="rounded-2xl border border-menta/20 bg-petroleo-2/60 p-5">
      <p className="text-xs text-areia/50">
        Cole um link que te inspirou, ou aponte pra um arquivo que já está no Drive da empresa — nunca baixamos nem
        raspamos conteúdo de outro lugar automaticamente.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setOrigem("external_url")}
          className={`mono-label rounded-lg px-3 py-1.5 transition ${origem === "external_url" ? "bg-menta/10 text-menta" : "text-areia-2 hover:text-areia"}`}
        >
          Link externo
        </button>
        <button
          type="button"
          onClick={() => setOrigem("upload")}
          className={`mono-label rounded-lg px-3 py-1.5 transition ${origem === "upload" ? "bg-menta/10 text-menta" : "text-areia-2 hover:text-areia"}`}
        >
          Já no Drive
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da referência"
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30"
        />

        {origem === "external_url" ? (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30"
          />
        ) : (
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia"
          >
            <option value="">— escolher arquivo do Drive —</option>
            {assetsDrive.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        )}

        <input
          value={tagsTexto}
          onChange={(e) => setTagsTexto(e.target.value)}
          placeholder="Tags separadas por vírgula (ex: elegante, premium)"
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30"
        />

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia"
        >
          <option value="">Sem departamento definido</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.label}
            </option>
          ))}
        </select>

        <input
          value={direitosUso}
          onChange={(e) => setDireitosUso(e.target.value)}
          placeholder="Direitos de uso (ex: só inspiração interna)"
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30 sm:col-span-2"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que te chamou atenção nessa referência (opcional)"
          rows={2}
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30 sm:col-span-2"
        />
      </div>

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="mono-label mt-4 rounded-lg border border-menta/40 bg-menta/10 px-4 py-2 text-menta transition hover:bg-menta/20 disabled:opacity-40"
      >
        {enviando ? "Salvando..." : "Salvar referência"}
      </button>
    </div>
  );
}

function ColecoesPainel({ colecoes, onCriar }: { colecoes: Colecao[]; onCriar: (nome: string) => void }) {
  const [nome, setNome] = useState("");

  return (
    <div className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-5">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/60">Coleções</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {colecoes.length === 0 && <p className="text-xs text-areia/40">Nenhuma coleção ainda.</p>}
        {colecoes.map((c) => (
          <span key={c.id} className="mono-label rounded-lg border border-areia/15 px-3 py-1.5 text-areia-2">
            {c.nome}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da nova coleção"
          className="flex-1 rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-1.5 text-sm text-areia placeholder:text-areia/30"
        />
        <button
          type="button"
          onClick={() => {
            onCriar(nome);
            setNome("");
          }}
          className="mono-label rounded-lg border border-areia/20 px-3 py-1.5 text-areia-2 hover:text-areia"
        >
          Criar
        </button>
      </div>
    </div>
  );
}

function ReferenciaCard({
  item,
  clienteId,
  colecoes,
  analisando,
  onArquivar,
  onAdicionarNaColecao,
  onAnalisarEstilo,
}: {
  item: ItemReferencia;
  clienteId: string;
  colecoes: Colecao[];
  analisando: boolean;
  onArquivar: (id: string) => void;
  onAdicionarNaColecao: (itemId: string, collectionId: string) => void;
  onAnalisarEstilo: (item: ItemReferencia) => void;
}) {
  const editavel = item.clienteId === clienteId;
  const podeAnalisar = item.isVideo || item.isImage;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/60">
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-petroleo-3/60">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt={item.title} className="size-full object-cover" />
        ) : item.externalUrl ? (
          <a href={item.externalUrl} target="_blank" rel="noreferrer" className="mono-label px-3 text-center text-menta underline">
            Ver link
          </a>
        ) : (
          <span className="text-xs text-areia/30">sem prévia</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-areia">{item.title}</p>
          <span className="mono-label shrink-0 rounded border border-areia/15 px-1.5 py-0.5 text-[10px] text-areia/50">
            {ORIGEM_LABEL[item.sourceType]}
          </span>
        </div>
        {item.department && <p className="mono-label text-[10px] text-areia/40">{DEPARTAMENTOS.find((d) => d.valor === item.department)?.label ?? item.department}</p>}
        {item.description && <p className="line-clamp-2 text-xs text-areia/50">{item.description}</p>}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t} className="rounded border border-areia/10 px-1.5 py-0.5 text-[10px] text-areia/40">
                {t}
              </span>
            ))}
          </div>
        )}
        {item.direitosUso && <p className="text-[10px] text-ambar/70">{item.direitosUso}</p>}

        {podeAnalisar && (
          <div className="rounded-lg border border-menta/15 bg-petroleo-3/40 p-2">
            {item.perfilEstilo ? (
              <div className="space-y-1 text-[10px] text-areia/60">
                {item.perfilEstilo.resumoSimples && (
                  <p className="text-xs font-medium italic text-menta">“{item.perfilEstilo.resumoSimples}”</p>
                )}
                <p>
                  <span className="text-areia/40">Ritmo:</span> {item.perfilEstilo.pacing} ({item.perfilEstilo.cutDensityPerMinute} cortes/min)
                </p>
                <p>
                  <span className="text-areia/40">Cor:</span> {item.perfilEstilo.colorProfile}
                </p>
                <p>
                  <span className="text-areia/40">Abertura:</span> {item.perfilEstilo.hookStructure}
                </p>
              </div>
            ) : item.perfilVisual ? (
              <div className="space-y-1 text-[10px] text-areia/60">
                {item.perfilVisual.resumoSimples && (
                  <p className="text-xs font-medium italic text-menta">“{item.perfilVisual.resumoSimples}”</p>
                )}
                <p>
                  <span className="text-areia/40">Composição:</span> {item.perfilVisual.composicao}
                </p>
                <p>
                  <span className="text-areia/40">Paleta:</span> {item.perfilVisual.paleta}
                </p>
                <p>
                  <span className="text-areia/40">Hierarquia:</span> {item.perfilVisual.hierarquia}
                </p>
                <p>
                  <span className="text-areia/40">Tratamento:</span> {item.perfilVisual.tratamentoImagem}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAnalisarEstilo(item)}
                disabled={analisando}
                className="mono-label w-full text-center text-menta hover:text-menta/70 disabled:opacity-40"
              >
                {analisando ? "Analisando..." : "Ver análise visual"}
              </button>
            )}
          </div>
        )}

        <Link
          href={`/design?referencia=${item.id}&nome=${encodeURIComponent(item.title)}`}
          className="mono-label mt-1 block rounded-lg border border-ambar/30 bg-ambar/10 px-2 py-1.5 text-center text-[11px] text-ambar hover:bg-ambar/20"
        >
          Usar como inspiração
        </Link>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <select
            defaultValue=""
            onChange={(e) => {
              onAdicionarNaColecao(item.id, e.target.value);
              e.target.value = "";
            }}
            className="flex-1 rounded-lg border border-areia/15 bg-petroleo-3/60 px-2 py-1 text-[11px] text-areia"
          >
            <option value="">+ coleção</option>
            {colecoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {editavel && (
            <button
              type="button"
              onClick={() => onArquivar(item.id)}
              className="mono-label rounded-lg border border-areia/15 px-2 py-1 text-[11px] text-areia/50 hover:text-coral"
            >
              Arquivar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
