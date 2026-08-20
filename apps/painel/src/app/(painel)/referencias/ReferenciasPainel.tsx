"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
  const [erro, setErro] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const idsDaColecaoFiltro = useMemo(() => {
    if (colecaoFiltro === "todas") return null;
    return new Set(itensPorColecao.filter((r) => r.collectionId === colecaoFiltro).map((r) => r.itemId));
  }, [itensPorColecao, colecaoFiltro]);

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
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
  }, [itens, busca, departamentoFiltro, idsDaColecaoFiltro]);

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

      setItens((atual) => [{ ...mapearLinha(data), thumbnailUrl }, ...atual]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui salvar a referência agora.");
    } finally {
      setEnviando(false);
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
    <div className="mt-8 space-y-8">
      <AdicionarReferenciaForm enviando={enviando} assetsDrive={assetsDrive} onAdicionarUrl={adicionarPorUrl} onAdicionarDrive={adicionarDoDrive} />
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}

      <ColecoesPainel colecoes={colecoes} onCriar={criarColecao} />

      <div className="flex flex-wrap items-center gap-3">
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtrados.length === 0 && (
          <p className="col-span-full rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Nenhuma referência encontrada — adicione a primeira acima.
          </p>
        )}
        {filtrados.map((item) => (
          <ReferenciaCard
            key={item.id}
            item={item}
            clienteId={clienteId}
            colecoes={colecoes}
            onArquivar={arquivar}
            onAdicionarNaColecao={adicionarNaColecao}
          />
        ))}
      </div>
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
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-menta">Adicionar referência</h2>
      <p className="mt-1 text-xs text-areia/50">
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
          placeholder="Tags separadas por vírgula"
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
  onArquivar,
  onAdicionarNaColecao,
}: {
  item: ItemReferencia;
  clienteId: string;
  colecoes: Colecao[];
  onArquivar: (id: string) => void;
  onAdicionarNaColecao: (itemId: string, collectionId: string) => void;
}) {
  const editavel = item.clienteId === clienteId;

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
