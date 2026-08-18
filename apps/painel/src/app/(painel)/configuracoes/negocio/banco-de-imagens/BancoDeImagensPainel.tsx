"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Asset {
  id: string;
  nome: string;
  pasta: string;
  folderId: string | null;
  tags: string[];
  categoria: string;
  descricao: string | null;
  status: string;
  isLogoPrincipal: boolean;
  favorito: boolean;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  url: string | null;
}

interface Pasta {
  id: string;
  parentId: string | null;
  nome: string;
  categoria: string | null;
}

interface BrandKitLogo {
  id: string;
  logoPrincipalAssetId: string | null;
  logoFundoClaroAssetId: string | null;
  logoFundoEscuroAssetId: string | null;
  logoMonocromaticaAssetId: string | null;
  simboloAssetId: string | null;
  logoPorFormato: Record<string, string>;
}

const CATEGORIAS = [
  { valor: "identidade_visual", label: "Identidade visual" },
  { valor: "produtos_servicos", label: "Produtos e serviços" },
  { valor: "pessoas_especialistas", label: "Pessoas e especialistas" },
  { valor: "ambientes_operacao", label: "Ambientes e operação" },
  { valor: "campanhas_referencias", label: "Campanhas e referências" },
  { valor: "documentos_contexto", label: "Documentos de contexto" },
  { valor: "outro", label: "Outros" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aprovado: "Aprovado",
  arquivado: "Arquivado",
  rejeitado: "Rejeitado",
};

const STATUS_COR: Record<string, string> = {
  rascunho: "text-areia/50 border-areia/20",
  aprovado: "text-menta border-menta/40",
  arquivado: "text-areia/30 border-areia/15",
  rejeitado: "text-coral border-coral/40",
};

const VARIANTES_LOGO = [
  { campo: "logoPrincipalAssetId", coluna: "logo_principal_asset_id", chave: "principal", label: "Logo principal" },
  { campo: "logoFundoClaroAssetId", coluna: "logo_fundo_claro_asset_id", chave: "fundo_claro", label: "Fundo claro" },
  { campo: "logoFundoEscuroAssetId", coluna: "logo_fundo_escuro_asset_id", chave: "fundo_escuro", label: "Fundo escuro" },
  { campo: "logoMonocromaticaAssetId", coluna: "logo_monocromatica_asset_id", chave: "monocromatica", label: "Monocromática" },
  { campo: "simboloAssetId", coluna: "simbolo_asset_id", chave: "simbolo", label: "Símbolo isolado" },
] as const;

const FORMATOS = [
  { valor: "feed", label: "Feed" },
  { valor: "story", label: "Story/Reels" },
  { valor: "avatar", label: "Avatar" },
] as const;

export default function BancoDeImagensPainel({
  clienteId,
  assetsIniciais,
  pastasIniciais,
  brandKitInicial,
}: {
  clienteId: string;
  assetsIniciais: Asset[];
  pastasIniciais: Pasta[];
  brandKitInicial: BrandKitLogo | null;
}) {
  const [assets, setAssets] = useState(assetsIniciais);
  const [pastas, setPastas] = useState(pastasIniciais);
  const [brandKit, setBrandKit] = useState(brandKitInicial);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const filtrados = useMemo(() => {
    return assets.filter((a) => {
      if (categoriaFiltro !== "todas" && a.categoria !== categoriaFiltro) return false;
      if (statusFiltro !== "todos" && a.status !== statusFiltro) return false;
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase();
      return (
        a.nome.toLowerCase().includes(termo) ||
        a.descricao?.toLowerCase().includes(termo) ||
        a.tags.some((t) => t.toLowerCase().includes(termo)) ||
        a.pasta.toLowerCase().includes(termo)
      );
    });
  }, [assets, busca, categoriaFiltro, statusFiltro]);

  const assetsIdentidadeVisual = useMemo(() => assets.filter((a) => a.categoria === "identidade_visual"), [assets]);

  async function enviarArquivo(file: File, categoria: string, pasta: string, tagsTexto: string, descricao: string) {
    setEnviando(true);
    setErro(null);
    try {
      const path = `${clienteId}/banco/${crypto.randomUUID()}-${file.name}`;
      const { error: erroUpload } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const tags = tagsTexto
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { data, error: erroInsert } = await supabase
        .from("business_assets")
        .insert({
          cliente_id: clienteId,
          storage_path: path,
          nome: file.name,
          pasta: pasta || "geral",
          categoria,
          tags,
          descricao: descricao || null,
          mime_type: file.type,
          size_bytes: file.size,
        })
        .select("id, storage_path, nome, pasta, folder_id, tags, categoria, descricao, status, is_logo_principal, favorito, mime_type, created_at, updated_at")
        .single();
      if (erroInsert || !data) throw new Error(erroInsert?.message ?? "Falha ao salvar");

      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60);
      setAssets((atual) => [
        {
          id: data.id as string,
          nome: data.nome as string,
          pasta: data.pasta as string,
          folderId: data.folder_id as string | null,
          tags: (data.tags as string[]) ?? [],
          categoria: data.categoria as string,
          descricao: data.descricao as string | null,
          status: data.status as string,
          isLogoPrincipal: data.is_logo_principal as boolean,
          favorito: data.favorito as boolean,
          mimeType: data.mime_type as string | null,
          createdAt: data.created_at as string,
          updatedAt: data.updated_at as string,
          url: signed?.signedUrl ?? null,
        },
        ...atual,
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui enviar o arquivo agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function atualizarAsset(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("business_assets").update(patch).eq("id", id);
    if (error) {
      setErro(error.message);
      return;
    }
    setAssets((atual) => atual.map((a) => (a.id === id ? { ...a, ...mapPatchParaAsset(patch) } : a)));
  }

  async function apagar(id: string) {
    const { error } = await supabase.from("business_assets").delete().eq("id", id);
    if (!error) setAssets((atual) => atual.filter((a) => a.id !== id));
  }

  async function atualizarLogo(campoAssetId: string, coluna: string, assetId: string | null) {
    const payload: Record<string, unknown> = { [coluna]: assetId };
    if (brandKit) {
      const { error } = await supabase.from("brand_kits").update(payload).eq("id", brandKit.id);
      if (error) {
        setErro(error.message);
        return;
      }
      setBrandKit((atual) => (atual ? { ...atual, [campoAssetId]: assetId } : atual));
    } else {
      const { data, error } = await supabase
        .from("brand_kits")
        .insert({ cliente_id: clienteId, is_atual: true, ...payload })
        .select("id")
        .single();
      if (error || !data) {
        setErro(error?.message ?? "Falha ao criar brand kit");
        return;
      }
      setBrandKit({
        id: data.id as string,
        logoPrincipalAssetId: null,
        logoFundoClaroAssetId: null,
        logoFundoEscuroAssetId: null,
        logoMonocromaticaAssetId: null,
        simboloAssetId: null,
        logoPorFormato: {},
        [campoAssetId]: assetId,
      } as BrandKitLogo);
    }
  }

  async function atualizarLogoPorFormato(formato: string, variante: string) {
    if (!brandKit) return;
    const novoMapa = { ...brandKit.logoPorFormato, [formato]: variante };
    const { error } = await supabase.from("brand_kits").update({ logo_por_formato: novoMapa }).eq("id", brandKit.id);
    if (error) {
      setErro(error.message);
      return;
    }
    setBrandKit((atual) => (atual ? { ...atual, logoPorFormato: novoMapa } : atual));
  }

  async function criarPasta(nome: string, categoria: string) {
    if (!nome.trim()) return;
    const { data, error } = await supabase
      .from("business_asset_folders")
      .insert({ cliente_id: clienteId, nome: nome.trim(), categoria: categoria || null })
      .select("id, parent_id, nome, categoria")
      .single();
    if (error || !data) {
      setErro(error?.message ?? "Falha ao criar pasta");
      return;
    }
    setPastas((atual) => [...atual, { id: data.id as string, parentId: data.parent_id as string | null, nome: data.nome as string, categoria: data.categoria as string | null }]);
  }

  return (
    <div className="mt-8 space-y-8">
      <PainelLogoOficial
        brandKit={brandKit}
        assetsIdentidadeVisual={assetsIdentidadeVisual}
        onAtualizarLogo={atualizarLogo}
        onAtualizarFormato={atualizarLogoPorFormato}
      />

      <UploadForm enviando={enviando} pastas={pastas} onEnviar={enviarArquivo} onCriarPasta={criarPasta} />
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, descrição, tag ou pasta..."
          className="flex-1 rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-2 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
        >
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
        >
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtrados.length === 0 && (
          <p className="col-span-full rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Nenhum ativo encontrado — envie o primeiro acima.
          </p>
        )}
        {filtrados.map((a) => (
          <AssetCard key={a.id} asset={a} onAtualizar={atualizarAsset} onApagar={apagar} />
        ))}
      </div>
    </div>
  );
}

function mapPatchParaAsset(patch: Record<string, unknown>): Partial<Asset> {
  const mapa: Partial<Asset> = {};
  if ("nome" in patch) mapa.nome = patch.nome as string;
  if ("descricao" in patch) mapa.descricao = patch.descricao as string | null;
  if ("status" in patch) mapa.status = patch.status as string;
  if ("favorito" in patch) mapa.favorito = patch.favorito as boolean;
  if ("is_logo_principal" in patch) mapa.isLogoPrincipal = patch.is_logo_principal as boolean;
  if ("tags" in patch) mapa.tags = patch.tags as string[];
  return mapa;
}

function PainelLogoOficial({
  brandKit,
  assetsIdentidadeVisual,
  onAtualizarLogo,
  onAtualizarFormato,
}: {
  brandKit: BrandKitLogo | null;
  assetsIdentidadeVisual: Asset[];
  onAtualizarLogo: (campo: string, coluna: string, assetId: string | null) => void;
  onAtualizarFormato: (formato: string, variante: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-ambar/20 bg-petroleo-2/60 p-5">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-ambar">Logo oficial</h2>
      <p className="mt-1 text-xs text-areia/50">
        O agente de Design incorpora a logo real (não desenha de memória). Marque um arquivo de &quot;Identidade
        visual&quot; abaixo pra cada variante — sem isso cadastrado, o Design avisa &quot;sem logo&quot; em vez de
        inventar.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {VARIANTES_LOGO.map((v) => (
          <div key={v.campo}>
            <label className="text-[10px] uppercase tracking-wide text-areia/40">{v.label}</label>
            <select
              value={(brandKit?.[v.campo as keyof BrandKitLogo] as string | null) ?? ""}
              onChange={(e) => onAtualizarLogo(v.campo, v.coluna, e.target.value || null)}
              className="mt-1 w-full rounded-xl border border-areia/15 bg-petroleo-3/60 px-2 py-1.5 text-xs text-areia"
            >
              <option value="">— nenhum —</option>
              {assetsIdentidadeVisual.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-areia/10 pt-4">
        {FORMATOS.map((f) => (
          <div key={f.valor}>
            <label className="text-[10px] uppercase tracking-wide text-areia/40">Preferência pro {f.label}</label>
            <select
              value={brandKit?.logoPorFormato[f.valor] ?? "principal"}
              onChange={(e) => onAtualizarFormato(f.valor, e.target.value)}
              className="mt-1 rounded-xl border border-areia/15 bg-petroleo-3/60 px-2 py-1.5 text-xs text-areia"
            >
              {VARIANTES_LOGO.map((v) => (
                <option key={v.chave} value={v.chave}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadForm({
  enviando,
  pastas,
  onEnviar,
  onCriarPasta,
}: {
  enviando: boolean;
  pastas: Pasta[];
  onEnviar: (file: File, categoria: string, pasta: string, tags: string, descricao: string) => void;
  onCriarPasta: (nome: string, categoria: string) => void;
}) {
  const [categoria, setCategoria] = useState<string>("outro");
  const [pasta, setPasta] = useState("");
  const [tags, setTags] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novaPasta, setNovaPasta] = useState("");

  return (
    <div className="rounded-2xl border border-dashed border-areia/20 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-xs text-areia">
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          value={pasta}
          onChange={(e) => setPasta(e.target.value)}
          placeholder="Pasta (ex: cardápio, equipe)"
          list="pastas-existentes"
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-xs text-areia placeholder:text-areia/30"
        />
        <datalist id="pastas-existentes">
          {pastas.map((p) => (
            <option key={p.id} value={p.nome} />
          ))}
        </datalist>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags separadas por vírgula"
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-xs text-areia placeholder:text-areia/30"
        />
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição curta (opcional)"
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-xs text-areia placeholder:text-areia/30"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full bg-ambar px-4 py-2 text-xs font-semibold text-petroleo transition hover:bg-ambar-forte">
          {enviando ? "Enviando..." : "Enviar arquivo"}
          <input
            type="file"
            disabled={enviando}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onEnviar(file, categoria, pasta, tags, descricao);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex items-center gap-2">
          <input
            value={novaPasta}
            onChange={(e) => setNovaPasta(e.target.value)}
            placeholder="Nova pasta..."
            className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-1.5 text-xs text-areia placeholder:text-areia/30"
          />
          <button
            onClick={() => {
              onCriarPasta(novaPasta, categoria);
              setNovaPasta("");
            }}
            className="rounded-full border border-areia/15 px-3 py-1.5 text-xs text-areia/70 hover:border-menta hover:text-menta"
          >
            Criar pasta
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onAtualizar,
  onApagar,
}: {
  asset: Asset;
  onAtualizar: (id: string, patch: Record<string, unknown>) => void;
  onApagar: (id: string) => void;
}) {
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [descricao, setDescricao] = useState(asset.descricao ?? "");

  return (
    <div className="overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/60">
      {asset.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt={asset.nome} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-petroleo-3/60 text-[10px] text-areia/30">
          {asset.mimeType ?? "arquivo"}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-medium text-areia">{asset.nome}</p>
          <button
            onClick={() => onAtualizar(asset.id, { favorito: !asset.favorito })}
            title={asset.favorito ? "Remover dos favoritos" : "Favoritar"}
            className={`shrink-0 text-xs ${asset.favorito ? "text-ambar" : "text-areia/20 hover:text-areia/50"}`}
          >
            ★
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${STATUS_COR[asset.status] ?? "text-areia/50 border-areia/20"}`}>
            {STATUS_LABEL[asset.status] ?? asset.status}
          </span>
          {asset.isLogoPrincipal && <span className="rounded-full border border-ambar/40 px-1.5 py-0.5 text-[9px] text-ambar">LOGO</span>}
          <span className="text-[9px] text-areia/40">{asset.pasta}</span>
        </div>
        {asset.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {asset.tags.map((t) => (
              <span key={t} className="rounded-full bg-menta/10 px-1.5 py-0.5 text-[9px] text-menta">
                {t}
              </span>
            ))}
          </div>
        )}

        {editandoDescricao ? (
          <div className="mt-2 flex gap-1">
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="flex-1 rounded-lg border border-areia/15 bg-petroleo-3/60 px-2 py-1 text-[10px] text-areia"
              placeholder="Descrição..."
            />
            <button
              onClick={() => {
                onAtualizar(asset.id, { descricao: descricao || null });
                setEditandoDescricao(false);
              }}
              className="text-[10px] text-menta"
            >
              salvar
            </button>
          </div>
        ) : (
          <button onClick={() => setEditandoDescricao(true)} className="mt-2 block truncate text-left text-[10px] text-areia/40 hover:text-areia/60">
            {asset.descricao || "+ adicionar descrição"}
          </button>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
          <select
            value={asset.status}
            onChange={(e) => onAtualizar(asset.id, { status: e.target.value })}
            className="rounded-lg border border-areia/15 bg-petroleo-3/60 px-1.5 py-1 text-[10px] text-areia"
          >
            {Object.entries(STATUS_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          {asset.categoria === "identidade_visual" && (
            <button
              onClick={() => onAtualizar(asset.id, { is_logo_principal: !asset.isLogoPrincipal })}
              className="text-areia/50 hover:text-ambar"
            >
              {asset.isLogoPrincipal ? "desmarcar logo" : "marcar como logo"}
            </button>
          )}
          <button onClick={() => onApagar(asset.id)} className="text-coral/70 hover:text-coral">
            remover
          </button>
        </div>
      </div>
    </div>
  );
}
